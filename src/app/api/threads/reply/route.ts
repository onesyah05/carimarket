import { ReplyMode, ReplyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deliverReplyForDraft } from "@/server/replies/delivery-service";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

const inputSchema = z.object({
  leadId: z.string().trim().min(1).max(191),
  postId: z.string().trim().min(1).max(191),
  body: z.string().trim().min(1).max(500),
  draftId: z.string().trim().min(1).max(191).optional(),
  confirmed: z.literal(true),
  idempotencyKey: z.string().trim().min(8).max(191),
});

export async function POST(request: Request) {
  let draftId: string | undefined;
  try {
    enforceSameOrigin(request);
    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Data balasan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });

    const user = await getWorkspaceUser();
    enforceRateLimit(`threads-reply:${user.id}`, 20, 60_000);

    const lead = await prisma.lead.findFirst({
      where: { id: input.data.leadId, userId: user.id },
      include: { threadPost: { select: { externalPostId: true } } },
    });
    if (!lead || lead.threadPost.externalPostId !== input.data.postId) {
      throw new ThreadsIntegrationError("LEAD_NOT_FOUND", "Lead Threads tidak ditemukan.", 404);
    }

    const existing = input.data.draftId
      ? await prisma.replyDraft.findFirst({ where: { id: input.data.draftId, leadId: lead.id, userId: user.id } })
      : null;
    if (input.data.draftId && !existing) {
      throw new ThreadsIntegrationError("DRAFT_NOT_FOUND", "Draf tidak ditemukan.", 404);
    }
    if (existing && !(new Set<ReplyStatus>([ReplyStatus.DRAFT, ReplyStatus.PENDING_APPROVAL, ReplyStatus.FLAGGED, ReplyStatus.FAILED])).has(existing.status)) {
      throw new ThreadsIntegrationError("DRAFT_LOCKED", "Draf ini sudah diproses.", 409);
    }
    const draft = existing
      ? await prisma.replyDraft.update({
        where: { id: existing.id },
        data: { body: input.data.body, status: ReplyStatus.APPROVED, deliveryMode: ReplyMode.REVIEW_FIRST, reviewedById: user.id, approvedAt: new Date(), version: { increment: 1 } },
      })
      : await prisma.replyDraft.create({
        data: {
          leadId: lead.id,
          userId: user.id,
          body: input.data.body,
          status: ReplyStatus.APPROVED,
          deliveryMode: ReplyMode.REVIEW_FIRST,
          reviewedById: user.id,
          approvedAt: new Date(),
        },
      });
    draftId = draft.id;

    const result = await deliverReplyForDraft(draft.id, input.data.idempotencyKey);
    if (result.status === "FAILED") {
      throw new ThreadsIntegrationError(
        result.errorCode && result.errorCode !== "REPLY_FAILED" ? result.errorCode : "REPLY_DELIVERY_FAILED",
        "Balasan belum dapat dikirim ke Threads. Periksa koneksi akun dan coba lagi.",
        409,
      );
    }
    return NextResponse.json({ success: true, data: { status: result.status, externalReplyId: result.externalReplyId } });
  } catch (error) {
    if (draftId) {
      await prisma.replyDraft.update({ where: { id: draftId }, data: { status: "FAILED" } }).catch(() => undefined);
    }
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
