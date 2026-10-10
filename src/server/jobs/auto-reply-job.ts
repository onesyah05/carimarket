import "server-only";
import { ConnectionStatus, LeadStatus, ReplyMode, ReplyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deterministicReplyGenerator } from "@/server/integrations/ai/reply-generator";
import { isWithinQuietHours } from "@/server/replies/automation-rules";
import { deliverReplyForDraft } from "@/server/replies/delivery-service";
import { hasReplyQuota } from "@/server/usage/limits";

/**
 * Hanya jalur resmi (OAuth Meta) yang mendukung publish. Jalur tidak resmi
 * hanya untuk pencarian pre-App-Review, jadi jangan pernah jadwalkan draft
 * yang pasti gagal dikirim.
 */
async function canPublishViaThreads(userId: string): Promise<boolean> {
  const connection = await prisma.threadsConnection.findFirst({
    where: { userId, status: ConnectionStatus.CONNECTED },
    select: { id: true },
  });
  return connection !== null;
}

async function repliesUsedToday(userId: string) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [sent, scheduled] = await Promise.all([
    prisma.replyDeliveryAttempt.count({ where: { replyDraft: { userId }, status: { in: [ReplyStatus.SENT, ReplyStatus.SIMULATED_SENT] }, attemptedAt: { gte: startOfDay } } }),
    prisma.replyDraft.count({ where: { userId, status: ReplyStatus.SCHEDULED, scheduledFor: { gte: startOfDay } } }),
  ]);
  return sent + scheduled;
}

export async function processAutoReplies(limitUsers = 50) {
  const summary = { usersChecked: 0, draftsCreated: 0, draftsFlagged: 0, draftsScheduled: 0, delivered: 0, deliveryFailed: 0, quotaBlocked: 0 };

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", replyAutomation: { isNot: null } },
    select: { id: true, replyAutomation: true },
    take: limitUsers,
  });
  if (users.length === 0) return summary;

  const blacklist = await prisma.blacklistTerm.findMany({ where: { isActive: true }, select: { normalized: true } });
  const blacklistTerms = blacklist.map(term => term.normalized);

  for (const user of users) {
    const setting = user.replyAutomation;
    if (!setting) continue;
    summary.usersChecked += 1;

    const newLeads = await prisma.lead.findMany({
      where: { userId: user.id, status: LeadStatus.NEW, replyDrafts: { none: {} } },
      orderBy: { relevanceScore: "desc" },
      take: 20,
      include: { threadPost: { select: { body: true } }, user: { include: { businessProfile: true } } },
    });

    for (const lead of newLeads) {
      const business = lead.user.businessProfile;
      const generated = await deterministicReplyGenerator.generate({
        businessName: business?.name ?? "bisnis kami",
        service: business?.category ?? "kebutuhan Anda",
        location: business?.serviceArea ?? undefined,
      });

      const risky = blacklistTerms.some(term => generated.body.toLowerCase().includes(term));
      if (risky && setting.pauseOnRisk) {
        const draft = await prisma.replyDraft.create({
          data: { leadId: lead.id, userId: user.id, body: generated.body, status: ReplyStatus.FLAGGED, deliveryMode: setting.mode, aiModel: generated.model },
        });
        await prisma.moderationFlag.create({
          data: { replyDraftId: draft.id, ruleCode: "BLACKLIST_TERM", reason: "Draft memuat istilah terlarang" },
        });
        summary.draftsFlagged += 1;
        continue;
      }

      if (setting.mode === ReplyMode.AUTO_SEND) {
        if (Number(lead.relevanceScore) < setting.minimumScore) continue;
        if (isWithinQuietHours(setting)) continue;
        // Batas kuota paket berlaku juga untuk pengiriman otomatis.
        if (!(await hasReplyQuota(user.id))) { summary.quotaBlocked += 1; continue; }
        const used = await repliesUsedToday(user.id);
        if (used >= setting.dailyLimit) continue;
        if (!(await canPublishViaThreads(user.id))) {
          // Tidak ada jalur publish yang aman saat ini (mis. belum App Review).
          // Tetap buat draft, tapi arahkan ke tinjauan manual, bukan dijadwalkan.
          await prisma.replyDraft.create({
            data: { leadId: lead.id, userId: user.id, body: generated.body, status: ReplyStatus.PENDING_APPROVAL, deliveryMode: ReplyMode.REVIEW_FIRST, aiModel: generated.model },
          });
          summary.draftsCreated += 1;
          continue;
        }
        await prisma.replyDraft.create({
          data: {
            leadId: lead.id,
            userId: user.id,
            body: generated.body,
            status: ReplyStatus.SCHEDULED,
            deliveryMode: ReplyMode.AUTO_SEND,
            aiModel: generated.model,
            scheduledFor: new Date(Date.now() + setting.delayMinutes * 60_000),
          },
        });
        summary.draftsScheduled += 1;
      } else {
        await prisma.replyDraft.create({
          data: { leadId: lead.id, userId: user.id, body: generated.body, status: ReplyStatus.PENDING_APPROVAL, deliveryMode: ReplyMode.REVIEW_FIRST, aiModel: generated.model },
        });
        summary.draftsCreated += 1;
      }
    }
  }

  const dueDrafts = await prisma.replyDraft.findMany({
    where: { status: ReplyStatus.SCHEDULED, scheduledFor: { lte: new Date() } },
    select: { id: true, userId: true, deliveryMode: true },
    orderBy: { scheduledFor: "asc" },
    take: 25,
  });
  for (const draft of dueDrafts) {
    // Aturan keamanan diperiksa lagi saat waktu kirim, bukan hanya saat buat draft.
    const setting = await prisma.replyAutomationSetting.findUnique({ where: { userId: draft.userId } });
    if (setting && draft.deliveryMode === ReplyMode.AUTO_SEND) {
      if (isWithinQuietHours(setting)) continue;
      if (await repliesUsedToday(draft.userId) >= setting.dailyLimit) continue;
    }
    if (!(await hasReplyQuota(draft.userId))) { summary.quotaBlocked += 1; continue; }
    const outcome = await deliverReplyForDraft(draft.id, `scheduled-${draft.id}`);
    if (outcome.status === ReplyStatus.SENT || outcome.status === ReplyStatus.SIMULATED_SENT) summary.delivered += 1;
    else if (outcome.status === ReplyStatus.FAILED) summary.deliveryFailed += 1;
  }

  return summary;
}
