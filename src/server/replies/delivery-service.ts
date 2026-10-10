import "server-only";
import { LeadStatus, ReplyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getThreadsAdapter } from "@/server/integrations/threads";
import { createNotification } from "@/server/notifications/service";
import { recordUsage } from "@/server/usage/service";

export type DeliveryOutcome = {
  status: ReplyStatus;
  externalReplyId?: string;
  errorCode?: string;
};

export async function deliverReplyForDraft(draftId: string, idempotencyKey: string): Promise<DeliveryOutcome> {
  const draft = await prisma.replyDraft.findUnique({
    where: { id: draftId },
    include: { lead: { include: { threadPost: { select: { externalPostId: true } } } } },
  });
  if (!draft) throw new Error("DRAFT_NOT_FOUND");

  const existing = await prisma.replyDeliveryAttempt.findUnique({ where: { idempotencyKey } });
  if (existing && (existing.status === ReplyStatus.SENT || existing.status === ReplyStatus.SIMULATED_SENT)) {
    await prisma.replyDraft.update({ where: { id: draft.id }, data: { status: existing.status, sentAt: existing.attemptedAt } }).catch(() => undefined);
    return { status: existing.status, externalReplyId: existing.externalReplyId ?? undefined };
  }

  const attempt = await prisma.replyDeliveryAttempt.upsert({
    where: { idempotencyKey },
    update: { status: ReplyStatus.SENDING, errorCode: null },
    create: { replyDraftId: draft.id, status: ReplyStatus.SENDING, idempotencyKey },
  });
  await prisma.replyDraft.update({ where: { id: draft.id }, data: { status: ReplyStatus.SENDING } });

  try {
    const adapter = await getThreadsAdapter(draft.userId);
    const result = await adapter.publishReply({
      postId: draft.lead.threadPost.externalPostId,
      body: draft.body,
      idempotencyKey,
    });
    const finalStatus = result.status === "SENT" ? ReplyStatus.SENT : ReplyStatus.SIMULATED_SENT;
    await prisma.$transaction([
      prisma.replyDeliveryAttempt.update({ where: { id: attempt.id }, data: { status: finalStatus, externalReplyId: result.externalReplyId } }),
      prisma.replyDraft.update({ where: { id: draft.id }, data: { status: finalStatus, sentAt: new Date() } }),
      prisma.lead.update({ where: { id: draft.leadId }, data: { status: LeadStatus.REPLIED } }),
    ]);
    await recordUsage(draft.userId, "REPLY", 1, draft.id);
    await createNotification({
      userId: draft.userId,
      type: "REPLY_SENT",
      title: finalStatus === ReplyStatus.SENT ? "Balasan terkirim ke Threads" : "Balasan tercatat (simulasi)",
      body: draft.body.slice(0, 180),
      href: "/dashboard/riwayat",
    });
    return { status: finalStatus, externalReplyId: result.externalReplyId };
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code).slice(0, 100) : "REPLY_FAILED";
    await prisma.$transaction([
      prisma.replyDeliveryAttempt.update({ where: { id: attempt.id }, data: { status: ReplyStatus.FAILED, errorCode: code } }),
      prisma.replyDraft.update({ where: { id: draft.id }, data: { status: ReplyStatus.FAILED } }),
    ]).catch(() => undefined);
    await createNotification({
      userId: draft.userId,
      type: "REPLY_FAILED",
      title: "Balasan gagal dikirim",
      body: `Pengiriman balasan tidak berhasil (${code}). Periksa koneksi Threads lalu coba lagi.`,
      href: "/dashboard/riwayat",
    });
    return { status: ReplyStatus.FAILED, errorCode: code };
  }
}
