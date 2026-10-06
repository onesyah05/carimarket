import "server-only";
import { ReplyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ReplyHistoryEntry = {
  id: string;
  recipient: string;
  topic: string;
  status: ReplyStatus;
  occurredAt: Date;
  body: string;
  errorCode: string | null;
};

const STATUS_ORDER: ReplyStatus[] = [
  ReplyStatus.SENT,
  ReplyStatus.SIMULATED_SENT,
  ReplyStatus.FAILED,
  ReplyStatus.SCHEDULED,
  ReplyStatus.APPROVED,
  ReplyStatus.PENDING_APPROVAL,
  ReplyStatus.FLAGGED,
  ReplyStatus.SENDING,
  ReplyStatus.DRAFT,
  ReplyStatus.CANCELLED,
];

const STATUS_LABEL: Record<ReplyStatus, string> = {
  DRAFT: "Draf",
  FLAGGED: "Ditandai",
  PENDING_APPROVAL: "Menunggu tinjauan",
  APPROVED: "Disetujui",
  SCHEDULED: "Terjadwal",
  SENDING: "Mengirim",
  SENT: "Terkirim",
  SIMULATED_SENT: "Terkirim (simulasi)",
  FAILED: "Gagal",
  CANCELLED: "Dibatalkan",
};

const STATUS_TONE: Record<ReplyStatus, "success" | "scheduled" | "failed"> = {
  DRAFT: "scheduled",
  FLAGGED: "failed",
  PENDING_APPROVAL: "scheduled",
  APPROVED: "success",
  SCHEDULED: "scheduled",
  SENDING: "scheduled",
  SENT: "success",
  SIMULATED_SENT: "success",
  FAILED: "failed",
  CANCELLED: "failed",
};

export async function listReplyHistory(userId: string, take = 50): Promise<ReplyHistoryEntry[]> {
  const drafts = await prisma.replyDraft.findMany({
    where: { userId },
    include: {
      lead: { include: { threadPost: { select: { authorName: true, authorHandle: true, body: true } }, keywordMatches: { include: { keyword: { select: { phrase: true } } }, take: 1 } } },
      attempts: { orderBy: { attemptedAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take,
  });

  return drafts
    .map(draft => {
      const post = draft.lead.threadPost;
      const recipient = post.authorName || post.authorHandle.replace(/^@/, "") || "Pengguna Threads";
      const lastAttempt = draft.attempts[0];
      const occurredAt = lastAttempt?.attemptedAt ?? draft.sentAt ?? draft.scheduledFor ?? draft.updatedAt;
      const topic = draft.lead.keywordMatches?.[0]?.keyword?.phrase ?? "";
      return {
        id: draft.id,
        recipient,
        topic,
        status: draft.status,
        occurredAt,
        body: draft.body,
        errorCode: lastAttempt?.errorCode ?? null,
      } satisfies ReplyHistoryEntry;
    })
    .sort((a, b) => {
      const rankA = STATUS_ORDER.indexOf(a.status);
      const rankB = STATUS_ORDER.indexOf(b.status);
      if (rankA !== rankB) return rankA - rankB;
      return b.occurredAt.getTime() - a.occurredAt.getTime();
    });
}

export function replyHistoryLabel(status: ReplyStatus) {
  return STATUS_LABEL[status];
}

export function replyHistoryTone(status: ReplyStatus) {
  return STATUS_TONE[status];
}
