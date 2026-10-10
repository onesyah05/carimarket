import "server-only";
import { KeywordKind, LeadStatus, Prisma, ReplyMode, ReplyStatus, SearchFrequency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/format";
import { getThreadsConnectionStatus } from "@/server/integrations/threads/connection-service";
import { isThreadsAvailable } from "@/server/integrations/threads/config";
import { isRiskyText, loadBlacklistTerms } from "@/server/replies/blacklist";
import { replyHistoryLabel } from "@/server/replies/queries";
import { runKeywordSearch } from "@/server/leads/search-service";
import { effectiveIntervalHours } from "@/server/leads/schedule";
import { assertKeywordQuota, getQuotaSnapshot } from "@/server/usage/limits";
import { ApiError } from "./handler";

/**
 * Logika domain untuk API mobile menu pengguna.
 *
 * Semua fungsi menerima `userId` dari kredensial API dan memakai layanan
 * domain yang sama dengan dashboard web, sehingga aturan kepemilikan, kuota,
 * dan penyaringan kata kunci tidak pernah berbeda antar klien.
 *
 * Bentuk data dibuat ramah mesin: nilai enum apa adanya ditemani label siap
 * tampil, waktu dalam ISO 8601 UTC, dan metrik yang tidak diketahui bernilai
 * null, bukan nol.
 */

const leadInclude = {
  threadPost: true,
  keywordMatches: { include: { keyword: { select: { phrase: true } } }, take: 1 },
} satisfies Prisma.LeadInclude;

type StoredLead = Prisma.LeadGetPayload<{ include: typeof leadInclude }>;

const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "Baru",
  SAVED: "Tersimpan",
  REPLIED: "Dibalas",
  ARCHIVED: "Arsip",
};

function serializeLead(lead: StoredLead, flagged: boolean) {
  const post = lead.threadPost;
  return {
    id: lead.id,
    status: lead.status,
    statusLabel: LEAD_STATUS_LABEL[lead.status],
    score: Math.round(Number(lead.relevanceScore)),
    matchReason: lead.matchReason,
    keyword: lead.keywordMatches[0]?.keyword.phrase ?? null,
    sourceMode: lead.sourceMode,
    flagged,
    discoveredAt: lead.discoveredAt.toISOString(),
    post: {
      externalId: post.externalPostId,
      permalink: post.permalink,
      text: post.body,
      postedAt: post.postedAt.toISOString(),
      author: { name: post.authorName, handle: post.authorHandle },
      engagement: { likes: post.likeCount, replies: post.replyCount, reposts: post.repostCount },
    },
  };
}

export async function getIdentity(userId: string) {
  const [user, profile, quota, connection] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, emailIsPlaceholder: true, createdAt: true } }),
    prisma.businessProfile.findUnique({ where: { userId } }),
    getQuotaSnapshot(userId),
    getThreadsConnectionStatus(userId),
  ]);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.emailIsPlaceholder ? null : user.email,
      emailIsPlaceholder: user.emailIsPlaceholder,
      joinedAt: user.createdAt.toISOString(),
    },
    business: profile ? {
      name: profile.name,
      category: profile.category,
      description: profile.description,
      serviceArea: profile.serviceArea,
      onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
    } : null,
    plan: serializePlan(quota),
    threads: { connected: Boolean(connection), username: connection?.username ?? null },
  };
}

function serializePlan(quota: Awaited<ReturnType<typeof getQuotaSnapshot>>) {
  return quota.plan
    ? {
      code: quota.plan.code,
      name: quota.plan.name,
      source: quota.plan.source,
      searchIntervalHours: quota.plan.searchIntervalHours,
    }
    : null;
}

function serializeQuota(quota: Awaited<ReturnType<typeof getQuotaSnapshot>>) {
  const shape = (check: { used: number; limit: number | null; remaining: number | null; allowed: boolean; warning: boolean; percentage: number | null }) => ({
    used: check.used,
    limit: check.limit,
    remaining: check.remaining,
    allowed: check.allowed,
    warning: check.warning,
    percentage: check.percentage,
  });
  return {
    periodStart: quota.periodStart.toISOString(),
    searches: shape(quota.search),
    replies: shape(quota.reply),
    keywords: shape(quota.keywords),
  };
}

export async function getSubscription(userId: string) {
  const [quota, subscription] = await Promise.all([
    getQuotaSnapshot(userId),
    prisma.subscription.findFirst({
      where: { userId, status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { code: true, name: true, monthlyPrice: true } } },
    }),
  ]);

  return {
    plan: serializePlan(quota),
    quota: serializeQuota(quota),
    subscription: subscription ? {
      status: subscription.status,
      statusLabel: statusLabel(subscription.status),
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      monthlyPrice: Number(subscription.plan.monthlyPrice),
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    } : null,
  };
}

export async function getOverview(userId: string) {
  const [quota, counts, automation, connection, unreadNotifications, pendingDrafts] = await Promise.all([
    getQuotaSnapshot(userId),
    prisma.lead.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    prisma.replyAutomationSetting.findUnique({ where: { userId } }),
    getThreadsConnectionStatus(userId),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.replyDraft.count({ where: { userId, status: { in: [ReplyStatus.PENDING_APPROVAL, ReplyStatus.FLAGGED, ReplyStatus.DRAFT] } } }),
  ]);

  const byStatus = (status: LeadStatus) => counts.find(row => row.status === status)?._count._all ?? 0;

  return {
    leads: {
      new: byStatus(LeadStatus.NEW),
      saved: byStatus(LeadStatus.SAVED),
      replied: byStatus(LeadStatus.REPLIED),
      total: counts.reduce((total, row) => total + row._count._all, 0),
    },
    replies: { awaitingReview: pendingDrafts },
    notifications: { unread: unreadNotifications },
    replyMode: automation ? (automation.mode === ReplyMode.AUTO_SEND ? "auto" : "review") : "review",
    plan: serializePlan(quota),
    quota: serializeQuota(quota),
    threads: {
      connected: Boolean(connection),
      username: connection?.username ?? null,
      tokenShortLived: connection?.tokenKind === "SHORT_LIVED",
    },
  };
}

export async function listLeads(userId: string, options: { status?: LeadStatus; minScore?: number; query?: string; skip: number; take: number }) {
  const where: Prisma.LeadWhereInput = {
    userId,
    ...(options.status ? { status: options.status } : {}),
    ...(options.minScore !== undefined ? { relevanceScore: { gte: options.minScore } } : {}),
    ...(options.query ? { threadPost: { body: { contains: options.query } } } : {}),
  };

  const [total, leads, blacklist] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({ where, include: leadInclude, orderBy: { discoveredAt: "desc" }, skip: options.skip, take: options.take }),
    loadBlacklistTerms(),
  ]);

  return { total, items: leads.map(lead => serializeLead(lead, isRiskyText(lead.threadPost.body, blacklist))) };
}

export async function getLeadDetail(userId: string, leadId: string) {
  const [lead, blacklist] = await Promise.all([
    prisma.lead.findFirst({ where: { id: leadId, userId }, include: leadInclude }),
    loadBlacklistTerms(),
  ]);
  if (!lead) throw new ApiError("NOT_FOUND", "Lead tidak ditemukan.");

  const draft = await prisma.replyDraft.findFirst({
    where: { userId, leadId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, body: true, status: true, scheduledFor: true, sentAt: true, updatedAt: true },
  });

  return {
    ...serializeLead(lead, isRiskyText(lead.threadPost.body, blacklist)),
    draft: draft ? {
      id: draft.id,
      body: draft.body,
      status: draft.status,
      statusLabel: replyHistoryLabel(draft.status),
      scheduledFor: draft.scheduledFor?.toISOString() ?? null,
      sentAt: draft.sentAt?.toISOString() ?? null,
      updatedAt: draft.updatedAt.toISOString(),
    } : null,
  };
}

export async function setLeadSaved(userId: string, leadId: string, saved: boolean) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, userId }, select: { id: true, status: true } });
  if (!lead) throw new ApiError("NOT_FOUND", "Lead tidak ditemukan.");
  if (lead.status === LeadStatus.REPLIED) {
    throw new ApiError("CONFLICT", "Lead yang sudah dibalas tidak dapat diubah statusnya.");
  }
  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: { status: saved ? LeadStatus.SAVED : LeadStatus.NEW },
    select: { status: true },
  });
  return { id: leadId, status: updated.status, statusLabel: LEAD_STATUS_LABEL[updated.status] };
}

export async function runSearch(userId: string, query: string) {
  if (!(await isThreadsAvailable())) {
    throw new ApiError("THREADS_UNAVAILABLE", "Koneksi Threads belum tersedia. Hubungi administrator workspace.");
  }
  const normalized = query.toLocaleLowerCase("id-ID");
  await assertKeywordQuota(userId, KeywordKind.INCLUDE, normalized);
  const keyword = await prisma.keyword.upsert({
    where: { userId_normalized_kind: { userId, normalized, kind: KeywordKind.INCLUDE } },
    update: { phrase: query, isActive: true, lastRunAt: new Date() },
    create: { userId, phrase: query, normalized, kind: KeywordKind.INCLUDE, lastRunAt: new Date() },
  });

  const result = await runKeywordSearch(keyword.id);
  return {
    keyword: { id: keyword.id, phrase: keyword.phrase },
    resultCount: result.resultCount,
    excludedCount: result.excludedCount,
    newLeadCount: result.createdCount,
  };
}

function serializeKeyword(keyword: { id: string; phrase: string; kind: KeywordKind; frequency: SearchFrequency; isActive: boolean; lastRunAt: Date | null; nextRunAt: Date | null; _count: { leadMatches: number } }, planIntervalHours: number | null) {
  return {
    id: keyword.id,
    phrase: keyword.phrase,
    kind: keyword.kind,
    negative: keyword.kind === KeywordKind.EXCLUDE,
    frequency: keyword.frequency,
    effectiveIntervalHours: effectiveIntervalHours(keyword.frequency, planIntervalHours),
    active: keyword.isActive,
    matchCount: keyword._count.leadMatches,
    lastRunAt: keyword.lastRunAt?.toISOString() ?? null,
    nextRunAt: keyword.nextRunAt?.toISOString() ?? null,
  };
}

export async function listKeywords(userId: string) {
  const [keywords, quota] = await Promise.all([
    prisma.keyword.findMany({ where: { userId }, include: { _count: { select: { leadMatches: true } } }, orderBy: { createdAt: "desc" } }),
    getQuotaSnapshot(userId),
  ]);
  const planInterval = quota.plan?.searchIntervalHours ?? null;
  return {
    items: keywords.map(keyword => serializeKeyword(keyword, planInterval)),
    limit: quota.keywords.limit,
    used: quota.keywords.used,
    planSearchIntervalHours: planInterval,
  };
}

export async function createKeyword(userId: string, input: { phrase: string; negative: boolean }) {
  const kind = input.negative ? KeywordKind.EXCLUDE : KeywordKind.INCLUDE;
  const normalized = input.phrase.toLocaleLowerCase("id-ID");
  await assertKeywordQuota(userId, kind, normalized);
  const keyword = await prisma.keyword.upsert({
    where: { userId_normalized_kind: { userId, normalized, kind } },
    update: { phrase: input.phrase, isActive: true },
    create: { userId, phrase: input.phrase, normalized, kind },
    include: { _count: { select: { leadMatches: true } } },
  });
  const quota = await getQuotaSnapshot(userId);
  return serializeKeyword(keyword, quota.plan?.searchIntervalHours ?? null);
}

export async function updateKeyword(userId: string, keywordId: string, input: { active?: boolean; frequency?: SearchFrequency }) {
  const result = await prisma.keyword.updateMany({
    where: { id: keywordId, userId },
    data: {
      ...(input.active === undefined ? {} : { isActive: input.active }),
      ...(input.frequency === undefined ? {} : { frequency: input.frequency }),
    },
  });
  if (!result.count) throw new ApiError("NOT_FOUND", "Kata kunci tidak ditemukan.");
  const keyword = await prisma.keyword.findUniqueOrThrow({ where: { id: keywordId }, include: { _count: { select: { leadMatches: true } } } });
  const quota = await getQuotaSnapshot(userId);
  return serializeKeyword(keyword, quota.plan?.searchIntervalHours ?? null);
}

export async function deleteKeyword(userId: string, keywordId: string) {
  const result = await prisma.keyword.deleteMany({ where: { id: keywordId, userId } });
  if (!result.count) throw new ApiError("NOT_FOUND", "Kata kunci tidak ditemukan.");
  return { id: keywordId, deleted: true };
}

export async function listReplies(userId: string, options: { status?: ReplyStatus; skip: number; take: number }) {
  const where: Prisma.ReplyDraftWhereInput = { userId, ...(options.status ? { status: options.status } : {}) };
  const [total, drafts] = await Promise.all([
    prisma.replyDraft.count({ where }),
    prisma.replyDraft.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: options.skip,
      take: options.take,
      include: {
        lead: { select: { id: true, threadPost: { select: { authorName: true, authorHandle: true, permalink: true } }, keywordMatches: { include: { keyword: { select: { phrase: true } } }, take: 1 } } },
        attempts: { orderBy: { attemptedAt: "desc" }, take: 1, select: { status: true, errorCode: true, attemptedAt: true, externalReplyId: true } },
      },
    }),
  ]);

  return {
    total,
    items: drafts.map(draft => {
      const attempt = draft.attempts[0];
      return {
        id: draft.id,
        leadId: draft.lead.id,
        body: draft.body,
        status: draft.status,
        statusLabel: replyHistoryLabel(draft.status),
        deliveryMode: draft.deliveryMode,
        keyword: draft.lead.keywordMatches[0]?.keyword.phrase ?? null,
        recipient: {
          name: draft.lead.threadPost.authorName,
          handle: draft.lead.threadPost.authorHandle,
          permalink: draft.lead.threadPost.permalink,
        },
        scheduledFor: draft.scheduledFor?.toISOString() ?? null,
        sentAt: draft.sentAt?.toISOString() ?? null,
        updatedAt: draft.updatedAt.toISOString(),
        lastAttempt: attempt ? {
          status: attempt.status,
          errorCode: attempt.errorCode,
          externalReplyId: attempt.externalReplyId,
          attemptedAt: attempt.attemptedAt.toISOString(),
        } : null,
      };
    }),
  };
}

export async function getThreadsState(userId: string) {
  const [connection, available] = await Promise.all([getThreadsConnectionStatus(userId), isThreadsAvailable()]);
  return {
    searchAvailable: available,
    connected: Boolean(connection),
    username: connection?.username ?? null,
    capability: connection?.capability ?? null,
    tokenKind: connection?.tokenKind ?? null,
    tokenExpiresAt: connection?.tokenExpiresAt?.toISOString() ?? null,
    lastErrorCode: connection?.lastErrorCode ?? null,
    /** Menghubungkan akun Threads memakai OAuth di peramban, bukan di aplikasi. */
    connectUrl: "/api/integrations/threads/connect",
    replyRequiresOfficialConnection: true,
  };
}
