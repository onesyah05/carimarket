import "server-only";
import { ReplyMode, ReplyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { assertReplyQuota } from "@/server/usage/limits";
import { deliverReplyForDraft } from "./delivery-service";

/**
 * Penyimpanan draft dan pengiriman balasan.
 *
 * Dipakai bersama oleh dashboard web dan API mobile supaya aturan kepemilikan
 * lead, status draft yang boleh diubah, kuota paket, dan idempotensi
 * pengiriman hanya ada satu versi.
 */

const EDITABLE_STATUSES = new Set<ReplyStatus>([
  ReplyStatus.DRAFT,
  ReplyStatus.PENDING_APPROVAL,
  ReplyStatus.FLAGGED,
  ReplyStatus.FAILED,
]);

async function requireOwnedLead(userId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, userId },
    include: { threadPost: { select: { externalPostId: true } } },
  });
  if (!lead) throw new ThreadsIntegrationError("LEAD_NOT_FOUND", "Lead Threads tidak ditemukan.", 404);
  return lead;
}

async function requireEditableDraft(userId: string, leadId: string, draftId: string | undefined) {
  if (!draftId) return null;
  const draft = await prisma.replyDraft.findFirst({ where: { id: draftId, leadId, userId } });
  if (!draft) throw new ThreadsIntegrationError("DRAFT_NOT_FOUND", "Draf tidak ditemukan.", 404);
  if (!EDITABLE_STATUSES.has(draft.status)) {
    throw new ThreadsIntegrationError("DRAFT_LOCKED", "Draf ini sudah diproses dan tidak dapat diubah.", 409);
  }
  return draft;
}

export type SavedDraft = { id: string; body: string; status: ReplyStatus };

export async function saveReplyDraft(input: { userId: string; leadId: string; body: string; draftId?: string }): Promise<SavedDraft> {
  await requireOwnedLead(input.userId, input.leadId);
  const existing = await requireEditableDraft(input.userId, input.leadId, input.draftId);

  const draft = existing
    ? await prisma.replyDraft.update({
      where: { id: existing.id },
      data: { body: input.body, status: ReplyStatus.DRAFT, version: { increment: 1 } },
    })
    : await prisma.replyDraft.create({
      data: { userId: input.userId, leadId: input.leadId, body: input.body, status: ReplyStatus.DRAFT, deliveryMode: ReplyMode.REVIEW_FIRST },
    });

  return { id: draft.id, body: draft.body, status: draft.status };
}

export type SentReply = { draftId: string; status: ReplyStatus; externalReplyId: string | null };

/**
 * Menyetujui draft lalu mengirimnya ke Threads.
 *
 * Kuota paket diperiksa sebelum pengiriman. Bila `postId` disertakan, nilainya
 * harus cocok dengan postingan lead agar klien tidak membalas postingan lain.
 */
export async function sendReplyFromDraft(input: {
  userId: string;
  leadId: string;
  body: string;
  idempotencyKey: string;
  draftId?: string;
  postId?: string;
}): Promise<SentReply> {
  const lead = await requireOwnedLead(input.userId, input.leadId);
  if (input.postId && lead.threadPost.externalPostId !== input.postId) {
    throw new ThreadsIntegrationError("LEAD_NOT_FOUND", "Lead Threads tidak ditemukan.", 404);
  }

  await assertReplyQuota(input.userId);
  const existing = await requireEditableDraft(input.userId, input.leadId, input.draftId);

  const draft = existing
    ? await prisma.replyDraft.update({
      where: { id: existing.id },
      data: {
        body: input.body,
        status: ReplyStatus.APPROVED,
        deliveryMode: ReplyMode.REVIEW_FIRST,
        reviewedById: input.userId,
        approvedAt: new Date(),
        version: { increment: 1 },
      },
    })
    : await prisma.replyDraft.create({
      data: {
        leadId: input.leadId,
        userId: input.userId,
        body: input.body,
        status: ReplyStatus.APPROVED,
        deliveryMode: ReplyMode.REVIEW_FIRST,
        reviewedById: input.userId,
        approvedAt: new Date(),
      },
    });

  try {
    const result = await deliverReplyForDraft(draft.id, input.idempotencyKey);
    if (result.status === ReplyStatus.FAILED) {
      throw new ThreadsIntegrationError(
        result.errorCode && result.errorCode !== "REPLY_FAILED" ? result.errorCode : "REPLY_DELIVERY_FAILED",
        "Balasan belum dapat dikirim ke Threads. Periksa koneksi akun dan coba lagi.",
        409,
      );
    }
    return { draftId: draft.id, status: result.status, externalReplyId: result.externalReplyId ?? null };
  } catch (error) {
    await prisma.replyDraft.update({ where: { id: draft.id }, data: { status: ReplyStatus.FAILED } }).catch(() => undefined);
    throw error;
  }
}
