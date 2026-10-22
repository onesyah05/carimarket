import "server-only";
import { prisma } from "@/lib/prisma";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getQuotaSnapshot } from "@/server/usage/limits";

/**
 * Detail satu akun pelanggan untuk konsol internal.
 *
 * Dikumpulkan dalam satu tempat supaya konsol Admin dan Superadmin menampilkan
 * keadaan yang sama; yang membedakan keduanya hanya tindakan apa yang tersedia,
 * bukan apa yang terlihat.
 *
 * Yang sengaja TIDAK pernah ikut: ciphertext token Threads, hash kata sandi,
 * dan nilai kunci API. Panel internal tidak pernah menampilkan rahasia, bahkan
 * sebagian — `keyPrefix` cukup untuk mengenali perangkat.
 */

const RECENT_LIMIT = 10;

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export type UserDetail = Awaited<ReturnType<typeof loadUserDetail>>;

export async function loadUserDetail(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      emailIsPlaceholder: true,
      emailVerifiedAt: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      suspendedAt: true,
      passwordHash: true,
      businessProfiles: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          location: true,
          serviceArea: true,
          brandVoice: true,
          createdAt: true,
          _count: { select: { keywords: true, leads: true } },
        },
      },
      threadsConnections: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          status: true,
          capability: true,
          tokenKind: true,
          tokenExpiresAt: true,
          lastCheckedAt: true,
          lastErrorCode: true,
          createdAt: true,
        },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          createdAt: true,
          plan: { select: { name: true, code: true, monthlyPrice: true } },
        },
      },
      replyAutomation: {
        select: { mode: true, minimumScore: true, dailyLimit: true, delayMinutes: true, pauseOnRisk: true, quietHoursEnabled: true, quietHoursStart: true, quietHoursEnd: true },
      },
      notification: { select: { emailLead: true, emailReply: true, emailQuota: true } },
      apiCredentials: {
        where: { revokedAt: null },
        orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
        take: RECENT_LIMIT,
        select: { id: true, name: true, keyPrefix: true, source: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: RECENT_LIMIT,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          periodMonths: true,
          createdAt: true,
          reviewedAt: true,
          plan: { select: { name: true } },
        },
      },
      _count: { select: { keywords: true, leads: true, replyDrafts: true, searchRuns: true, supportTickets: true } },
    },
  });

  if (!user) throw new ThreadsIntegrationError("USER_NOT_FOUND", "Pengguna tidak ditemukan.", 404);

  // Kuota dan jejak audit diambil terpisah: keduanya tidak punya relasi
  // langsung ke User yang dapat diikutkan dalam satu select.
  const [quota, auditEntries, sentReplies] = await Promise.all([
    user.role === "USER" ? getQuotaSnapshot(user.id).catch(() => null) : Promise.resolve(null),
    prisma.auditLog.findMany({
      where: { OR: [{ actorId: user.id }, { entityType: "User", entityId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
      select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { name: true } } },
    }),
    prisma.replyDraft.count({ where: { userId: user.id, status: { in: ["SENT", "SIMULATED_SENT"] } } }),
  ]);

  return {
    account: {
      id: user.id,
      name: user.name,
      email: user.emailIsPlaceholder ? null : user.email,
      emailIsPlaceholder: user.emailIsPlaceholder,
      emailVerified: user.emailVerifiedAt !== null,
      hasPassword: user.passwordHash !== null,
      role: user.role,
      status: user.status,
      createdAt: iso(user.createdAt),
      lastLoginAt: iso(user.lastLoginAt),
      suspendedAt: iso(user.suspendedAt),
    },
    totals: {
      profiles: user.businessProfiles.length,
      keywords: user._count.keywords,
      leads: user._count.leads,
      drafts: user._count.replyDrafts,
      sentReplies,
      searchRuns: user._count.searchRuns,
      tickets: user._count.supportTickets,
    },
    quota: quota
      ? {
        planName: quota.plan?.name ?? null,
        planSource: quota.plan?.source ?? null,
        periodStart: quota.periodStart.toISOString(),
        search: quota.search,
        reply: quota.reply,
        keywords: quota.keywords,
      }
      : null,
    profiles: user.businessProfiles.map(profile => ({
      id: profile.id,
      name: profile.name,
      category: profile.category,
      description: profile.description,
      location: profile.location,
      serviceArea: profile.serviceArea,
      brandVoice: profile.brandVoice,
      keywordCount: profile._count.keywords,
      leadCount: profile._count.leads,
      createdAt: iso(profile.createdAt),
    })),
    connections: user.threadsConnections.map(connection => ({
      id: connection.id,
      username: connection.username,
      status: connection.status,
      capability: connection.capability,
      tokenKind: connection.tokenKind,
      tokenExpiresAt: iso(connection.tokenExpiresAt),
      lastCheckedAt: iso(connection.lastCheckedAt),
      lastErrorCode: connection.lastErrorCode,
      createdAt: iso(connection.createdAt),
    })),
    subscriptions: user.subscriptions.map(subscription => ({
      id: subscription.id,
      status: subscription.status,
      planName: subscription.plan.name,
      planCode: subscription.plan.code,
      monthlyPrice: Number(subscription.plan.monthlyPrice),
      currentPeriodStart: iso(subscription.currentPeriodStart),
      currentPeriodEnd: iso(subscription.currentPeriodEnd),
      createdAt: iso(subscription.createdAt),
    })),
    automation: user.replyAutomation,
    notifications: user.notification,
    devices: user.apiCredentials.map(credential => ({
      id: credential.id,
      name: credential.name,
      keyPrefix: credential.keyPrefix,
      source: credential.source,
      lastUsedAt: iso(credential.lastUsedAt),
      expiresAt: iso(credential.expiresAt),
      createdAt: iso(credential.createdAt),
    })),
    transactions: user.transactions.map(transaction => ({
      id: transaction.id,
      invoiceNumber: transaction.invoiceNumber,
      status: transaction.status,
      totalAmount: Number(transaction.totalAmount),
      periodMonths: transaction.periodMonths,
      planName: transaction.plan.name,
      createdAt: iso(transaction.createdAt),
      reviewedAt: iso(transaction.reviewedAt),
    })),
    audit: auditEntries.map(entry => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      actorName: entry.actor?.name ?? "Sistem",
      createdAt: iso(entry.createdAt),
    })),
  };
}
