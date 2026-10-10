import "server-only";
import { KeywordKind, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { DEFAULT_PLAN_INTERVAL_HOURS } from "@/server/leads/schedule";
import { createNotificationOnce } from "@/server/notifications/service";
import { currentPeriodStart, evaluateQuota, type PlanLimits, type QuotaCheck } from "./quota";

/**
 * Penegakan batas kuota paket.
 *
 * Batas berasal dari langganan aktif pengguna. Bila pengguna belum memiliki
 * langganan, paket termurah yang masih aktif dipakai sebagai batas bawaan
 * sehingga angka pada halaman Paket benar-benar berlaku, bukan hanya tampilan.
 * Bila belum ada paket sama sekali, pemakaian tidak dibatasi.
 */

export type WorkspacePlan = PlanLimits & {
  code: string;
  name: string;
  /** Jarak minimum antar pencarian terjadwal, dalam jam. */
  searchIntervalHours: number;
  source: "subscription" | "default";
};

export type QuotaSnapshot = {
  plan: WorkspacePlan | null;
  periodStart: Date;
  search: QuotaCheck;
  reply: QuotaCheck;
  keywords: QuotaCheck;
};

const ACTIVE_SUBSCRIPTION_STATUSES = [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE];

export async function resolveWorkspacePlan(userId: string): Promise<WorkspacePlan | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: { in: ACTIVE_SUBSCRIPTION_STATUSES } },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });
  if (subscription?.plan) {
    return { ...toLimits(subscription.plan), code: subscription.plan.code, name: subscription.plan.name, searchIntervalHours: subscription.plan.searchIntervalHours, source: "subscription" };
  }

  const fallback = await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } });
  if (!fallback) return null;
  return { ...toLimits(fallback), code: fallback.code, name: fallback.name, searchIntervalHours: fallback.searchIntervalHours, source: "default" };
}

function toLimits(plan: PlanLimits): PlanLimits {
  return {
    monthlySearchLimit: plan.monthlySearchLimit,
    monthlyReplyLimit: plan.monthlyReplyLimit,
    keywordLimit: plan.keywordLimit,
  };
}

export async function getQuotaSnapshot(userId: string): Promise<QuotaSnapshot> {
  const periodStart = currentPeriodStart();
  const [plan, usage, keywordCount] = await Promise.all([
    resolveWorkspacePlan(userId),
    prisma.monthlyUsage.findUnique({ where: { userId_periodStart: { userId, periodStart } } }),
    prisma.keyword.count({ where: { userId } }),
  ]);

  return {
    plan,
    periodStart,
    search: evaluateQuota(usage?.searchCount ?? 0, plan?.monthlySearchLimit),
    reply: evaluateQuota(usage?.replyCount ?? 0, plan?.monthlyReplyLimit),
    keywords: evaluateQuota(keywordCount, plan?.keywordLimit),
  };
}

async function warnWhenNearLimit(userId: string, check: QuotaCheck, label: string, periodStart: Date) {
  if (!check.warning || check.limit === null) return;
  await createNotificationOnce({
    userId,
    type: "QUOTA_WARNING",
    title: `Kuota ${label} hampir habis`,
    body: `Pemakaian ${label} bulan ini ${check.used} dari ${check.limit}. Sisa ${check.remaining}.`,
    href: "/dashboard/langganan",
    since: periodStart,
  }).catch(() => undefined);
}

export async function assertSearchQuota(userId: string) {
  const snapshot = await getQuotaSnapshot(userId);
  if (!snapshot.search.allowed) {
    throw new ThreadsIntegrationError(
      "SEARCH_QUOTA_EXCEEDED",
      `Kuota pencarian paket ${snapshot.plan?.name ?? "Anda"} bulan ini sudah terpakai (${snapshot.search.used}/${snapshot.search.limit}). Tunggu periode berikutnya atau naikkan paket.`,
      429,
    );
  }
  await warnWhenNearLimit(userId, snapshot.search, "pencarian", snapshot.periodStart);
  return snapshot;
}

export async function assertReplyQuota(userId: string) {
  const snapshot = await getQuotaSnapshot(userId);
  if (!snapshot.reply.allowed) {
    throw new ThreadsIntegrationError(
      "REPLY_QUOTA_EXCEEDED",
      `Kuota balasan paket ${snapshot.plan?.name ?? "Anda"} bulan ini sudah terpakai (${snapshot.reply.used}/${snapshot.reply.limit}). Tunggu periode berikutnya atau naikkan paket.`,
      429,
    );
  }
  await warnWhenNearLimit(userId, snapshot.reply, "balasan", snapshot.periodStart);
  return snapshot;
}

export async function assertKeywordQuota(userId: string, kind: KeywordKind, normalized: string) {
  const [plan, existing, keywordCount] = await Promise.all([
    resolveWorkspacePlan(userId),
    prisma.keyword.findUnique({ where: { userId_normalized_kind: { userId, normalized, kind } }, select: { id: true } }),
    prisma.keyword.count({ where: { userId } }),
  ]);
  // Memperbarui kata kunci yang sudah ada tidak menambah jumlah terpakai.
  if (existing) return;
  const check = evaluateQuota(keywordCount, plan?.keywordLimit);
  if (!check.allowed) {
    throw new ThreadsIntegrationError(
      "KEYWORD_QUOTA_EXCEEDED",
      `Paket ${plan?.name ?? "Anda"} hanya mengizinkan ${check.limit} kata kunci. Hapus kata kunci lain atau naikkan paket.`,
      429,
    );
  }
}

/**
 * Jarak minimum antar pencarian terjadwal menurut paket pengguna.
 * Tanpa paket aktif, tidak ada lantai selain bawaan satu jam.
 */
export async function resolveSearchIntervalHours(userId: string): Promise<number> {
  const plan = await resolveWorkspacePlan(userId);
  return plan?.searchIntervalHours ?? DEFAULT_PLAN_INTERVAL_HOURS;
}

/** Dipakai worker: melewati pengguna yang kuotanya sudah habis tanpa melempar error. */
export async function hasSearchQuota(userId: string) {
  return (await getQuotaSnapshot(userId)).search.allowed;
}

export async function hasReplyQuota(userId: string) {
  return (await getQuotaSnapshot(userId)).reply.allowed;
}
