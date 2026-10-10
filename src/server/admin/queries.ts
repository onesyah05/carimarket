import "server-only";
import { prisma } from "@/lib/prisma";

const RECENT_LIMIT = 30;

export async function listPlatformUsers() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      emailVerifiedAt: true,
      emailIsPlaceholder: true,
      businessProfile: { select: { name: true, category: true } },
      subscriptions: { where: { status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } }, select: { plan: { select: { name: true } } }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listAdmins() {
  return prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPERADMIN"] }, deletedAt: null },
    orderBy: [{ role: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      adminPermissions: { select: { permission: true } },
    },
  });
}

export async function listAuditLog() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: RECENT_LIMIT,
    include: { actor: { select: { name: true } } },
  });
}

export async function listConnections() {
  const connections = await prisma.threadsConnection.findMany({
    orderBy: { createdAt: "desc" },
    take: RECENT_LIMIT,
    include: { user: { select: { name: true, email: true } } },
  });
  const usage = await prisma.monthlyUsage.findMany({ select: { userId: true, searchCount: true, replyCount: true } });
  const totals = new Map<string, { search: number; reply: number }>();
  for (const row of usage) {
    const current = totals.get(row.userId) ?? { search: 0, reply: 0 };
    current.search += row.searchCount;
    current.reply += row.replyCount;
    totals.set(row.userId, current);
  }
  return connections.map(connection => ({
    ...connection,
    searchCount: totals.get(connection.userId)?.search ?? 0,
    replyCount: totals.get(connection.userId)?.reply ?? 0,
  }));
}

export async function listFlaggedReplies() {
  return prisma.replyDraft.findMany({
    where: { status: "FLAGGED" },
    orderBy: { updatedAt: "asc" },
    take: RECENT_LIMIT,
    include: {
      user: { select: { name: true } },
      moderationFlags: { where: { resolvedAt: null }, select: { id: true, ruleCode: true, reason: true } },
    },
  });
}

export async function listModerationStats() {
  const [openFlags, resolvedFlags, activeTerms] = await Promise.all([
    prisma.moderationFlag.count({ where: { resolvedAt: null } }),
    prisma.moderationFlag.count({ where: { resolvedAt: { not: null } } }),
    prisma.blacklistTerm.count({ where: { isActive: true } }),
  ]);
  return { openFlags, resolvedFlags, activeTerms };
}

export async function listBlacklistTerms() {
  return prisma.blacklistTerm.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { createdBy: { select: { name: true } } },
  });
}

export async function listSupportTickets() {
  return prisma.supportTicket.findMany({
    orderBy: { updatedAt: "desc" },
    take: RECENT_LIMIT,
    include: {
      requester: { select: { name: true, email: true } },
      assignee: { select: { name: true } },
    },
  });
}

export async function listContactSubmissions() {
  return prisma.contactSubmission.findMany({
    orderBy: { createdAt: "desc" },
    take: RECENT_LIMIT,
  });
}

export async function listMonitoringSnapshot() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [searchRunsTotal, searchRunsFailed, replyAttempts, replyFailures, activeConnections] = await Promise.all([
    prisma.searchRun.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.searchRun.count({ where: { createdAt: { gte: dayAgo }, status: "FAILED" } }),
    prisma.replyDeliveryAttempt.count({ where: { attemptedAt: { gte: dayAgo } } }),
    prisma.replyDeliveryAttempt.count({ where: { attemptedAt: { gte: dayAgo }, status: "FAILED" } }),
    prisma.threadsConnection.count({ where: { status: "CONNECTED" } }),
  ]);
  return { searchRunsTotal, searchRunsFailed, replyAttempts, replyFailures, activeConnections };
}

export async function listArticlesForInternal() {
  return prisma.article.findMany({
    orderBy: { updatedAt: "desc" },
    take: RECENT_LIMIT,
    select: {
      id: true,
      title: true,
      status: true,
      scheduledFor: true,
      publishedAt: true,
      updatedAt: true,
      author: { select: { name: true } },
    },
  });
}

export async function getSuperadminOverview() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twelveDaysAgo = new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000);
  twelveDaysAgo.setUTCHours(0, 0, 0, 0);

  const [usersActive, usageAgg, searches24h, replies24h, connectionsActive, openFlags, recentRuns, suspendedUsers] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.monthlyUsage.aggregate({ _sum: { searchCount: true, replyCount: true } }),
    prisma.searchRun.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.replyDeliveryAttempt.count({ where: { attemptedAt: { gte: dayAgo } } }),
    prisma.threadsConnection.count({ where: { status: "CONNECTED" } }),
    prisma.moderationFlag.count({ where: { resolvedAt: null } }),
    prisma.searchRun.findMany({ where: { createdAt: { gte: twelveDaysAgo } }, select: { createdAt: true } }),
    prisma.user.count({ where: { status: "SUSPENDED", deletedAt: null } }),
  ]);

  const buckets: Array<{ label: string; count: number }> = [];
  const bucketIndex = new Map<string, number>();
  for (let index = 11; index >= 0; index -= 1) {
    const day = new Date(now.getTime() - index * 24 * 60 * 60 * 1000);
    const key = day.toISOString().slice(0, 10);
    bucketIndex.set(key, buckets.length);
    buckets.push({ label: `${day.getUTCDate()}/${day.getUTCMonth() + 1}`, count: 0 });
  }
  for (const run of recentRuns) {
    const index = bucketIndex.get(run.createdAt.toISOString().slice(0, 10));
    if (index !== undefined) buckets[index].count += 1;
  }

  return {
    usersActive,
    suspendedUsers,
    searchesMonth: usageAgg._sum.searchCount ?? 0,
    repliesMonth: usageAgg._sum.replyCount ?? 0,
    searches24h,
    replies24h,
    connectionsActive,
    openFlags,
    runsByDay: buckets,
  };
}

function relativeAge(date: Date) {
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  return `${Math.round(hours / 24)} hari`;
}

export type QueueItem = { id: string; label: string; user: string; category: string; age: string; status: string; href: string };

export async function getAdminOverview() {
  const [openTickets, urgentTickets, openFlags, flaggedDrafts, ticketRows, attentionConnections] = await Promise.all([
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_USER"] } } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_USER"] }, priority: { in: ["HIGH", "URGENT"] } } }),
    prisma.moderationFlag.count({ where: { resolvedAt: null } }),
    prisma.replyDraft.findMany({
      where: { status: "FLAGGED" },
      orderBy: { updatedAt: "asc" },
      take: 4,
      include: { user: { select: { name: true } }, moderationFlags: { where: { resolvedAt: null } } },
    }),
    prisma.supportTicket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_USER"] } },
      orderBy: [{ priority: "desc" }, { updatedAt: "asc" }],
      take: 4,
      include: { requester: { select: { name: true } } },
    }),
    prisma.threadsConnection.findMany({
      where: { status: { in: ["EXPIRED", "ERROR"] } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const queue: QueueItem[] = [];
  for (const draft of flaggedDrafts) {
    queue.push({
      id: `mod-${draft.id}`,
      label: draft.body.slice(0, 60) + (draft.body.length > 60 ? "…" : ""),
      user: draft.user.name,
      category: "Moderasi",
      age: relativeAge(draft.updatedAt),
      status: draft.moderationFlags[0]?.ruleCode ?? "Tinjau",
      href: "/admin/moderasi",
    });
  }
  for (const ticket of ticketRows) {
    queue.push({
      id: `tiket-${ticket.id}`,
      label: ticket.subject,
      user: ticket.requester.name,
      category: "Dukungan",
      age: relativeAge(ticket.updatedAt),
      status: ticket.priority === "HIGH" || ticket.priority === "URGENT" ? "Prioritas tinggi" : "Terbuka",
      href: "/admin/tiket",
    });
  }
  for (const connection of attentionConnections) {
    queue.push({
      id: `koneksi-${connection.id}`,
      label: `Token Threads ${connection.status === "EXPIRED" ? "kedaluwarsa" : "bermasalah"}`,
      user: connection.user.name,
      category: "Integrasi",
      age: relativeAge(connection.updatedAt),
      status: "Perlu user",
      href: "/admin/monitoring",
    });
  }

  return { openTickets, urgentTickets, openFlags, queue };
}
