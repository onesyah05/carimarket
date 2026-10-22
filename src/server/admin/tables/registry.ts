import "server-only";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { buildPage, normalizeQuery, skipFor, type TableDefinition, type TablePage, type TableQuery } from "./types";

/**
 * Daftar tabel konsol internal.
 *
 * Setiap entri menyebutkan peran yang boleh membacanya dan cara menjalankan
 * kuerinya. Otorisasi karena itu hidup bersama definisi datanya, bukan
 * tersebar di tiap route — menambah tabel baru tidak bisa lupa menyebut
 * perannya.
 *
 * Pola kuerinya seragam: hitung total dengan `where` yang sama seperti
 * pengambilan baris, lalu ambil satu halaman. Keduanya harus memakai `where`
 * yang persis sama, jika tidak nomor halamannya berbohong.
 *
 * Catatan MySQL: collation bawaan proyek ini `utf8mb4_unicode_ci`, jadi
 * `contains` sudah tidak membedakan huruf besar-kecil. Prisma pada MySQL
 * memang tidak mendukung `mode: "insensitive"`.
 */

const SUPER = ["SUPERADMIN"] as const;
const STAFF = ["SUPERADMIN", "ADMIN"] as const;

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function money(value: Prisma.Decimal | null | undefined) {
  return value ? Number(value) : 0;
}

/** Potongan pesan panjang agar muatan tabel tetap ringan. */
function preview(text: string, limit = 160) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed;
}

const ACTIVE_SUBSCRIPTION = ["TRIAL", "ACTIVE", "PAST_DUE"] as const;

const users: TableDefinition = {
  roles: [...STAFF],
  searchHint: "nama, email, atau nama bisnis",
  async run(query) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.q
        ? {
          OR: [
            { name: { contains: query.q } },
            { email: { contains: query.q } },
            { businessProfiles: { some: { name: { contains: query.q } } } },
          ],
        }
        : {}),
    };

    const total = await prisma.user.count({ where });
    const rows = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: skipFor(query, total),
      take: query.pageSize,
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
        businessProfiles: { select: { name: true, category: true }, orderBy: { createdAt: "asc" }, take: 1 },
        subscriptions: {
          where: { status: { in: [...ACTIVE_SUBSCRIPTION] } },
          select: { plan: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { businessProfiles: true, keywords: true, leads: true } },
      },
    });

    return buildPage(
      rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.emailIsPlaceholder ? null : row.email,
        emailIsPlaceholder: row.emailIsPlaceholder,
        emailVerified: row.emailVerifiedAt !== null,
        role: row.role,
        status: row.status,
        businessName: row.businessProfiles[0]?.name ?? null,
        businessCategory: row.businessProfiles[0]?.category ?? null,
        profileCount: row._count.businessProfiles,
        keywordCount: row._count.keywords,
        leadCount: row._count.leads,
        planName: row.subscriptions[0]?.plan.name ?? null,
        createdAt: iso(row.createdAt),
        lastLoginAt: iso(row.lastLoginAt),
      })),
      total,
      query,
    );
  },
};

const admins: TableDefinition = {
  roles: [...SUPER],
  searchHint: "nama atau email",
  async run(query) {
    const where: Prisma.UserWhereInput = {
      role: { in: ["ADMIN", "SUPERADMIN"] },
      deletedAt: null,
      ...(query.q ? { OR: [{ name: { contains: query.q } }, { email: { contains: query.q } }] } : {}),
    };

    const total = await prisma.user.count({ where });
    const rows = await prisma.user.findMany({
      where,
      orderBy: [{ role: "desc" }, { name: "asc" }],
      skip: skipFor(query, total),
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        adminPermissions: { select: { permission: true } },
      },
    });

    return buildPage(
      rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        status: row.status,
        permissions: row.adminPermissions.map(entry => entry.permission),
        lastLoginAt: iso(row.lastLoginAt),
      })),
      total,
      query,
    );
  },
};

const audit: TableDefinition = {
  roles: [...SUPER],
  searchHint: "aksi, jenis entitas, ID target, atau nama aktor",
  async run(query) {
    const where: Prisma.AuditLogWhereInput = query.q
      ? {
        OR: [
          { action: { contains: query.q } },
          { entityType: { contains: query.q } },
          { entityId: { contains: query.q } },
          { actor: { name: { contains: query.q } } },
        ],
      }
      : {};

    const total = await prisma.auditLog.count({ where });
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: skipFor(query, total),
      take: query.pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: { select: { id: true, name: true } },
      },
    });

    return buildPage(
      rows.map(row => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actorId: row.actor?.id ?? null,
        actorName: row.actor?.name ?? "Sistem",
        createdAt: iso(row.createdAt),
      })),
      total,
      query,
    );
  },
};

const contact: TableDefinition = {
  roles: [...STAFF],
  searchHint: "nama, email, perusahaan, atau isi pesan",
  async run(query) {
    const where: Prisma.ContactSubmissionWhereInput = query.q
      ? {
        OR: [
          { name: { contains: query.q } },
          { email: { contains: query.q } },
          { company: { contains: query.q } },
          { message: { contains: query.q } },
        ],
      }
      : {};

    const total = await prisma.contactSubmission.count({ where });
    const rows = await prisma.contactSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: skipFor(query, total),
      take: query.pageSize,
    });

    return buildPage(
      rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        company: row.company,
        message: preview(row.message, 220),
        createdAt: iso(row.createdAt),
      })),
      total,
      query,
    );
  },
};

const blacklist: TableDefinition = {
  roles: [...STAFF],
  searchHint: "istilah atau alasan",
  async run(query) {
    const where: Prisma.BlacklistTermWhereInput = query.q
      ? { OR: [{ term: { contains: query.q } }, { reason: { contains: query.q } }] }
      : {};

    const total = await prisma.blacklistTerm.count({ where });
    const rows = await prisma.blacklistTerm.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: skipFor(query, total),
      take: query.pageSize,
      include: { createdBy: { select: { name: true } } },
    });

    return buildPage(
      rows.map(row => ({
        id: row.id,
        term: row.term,
        reason: row.reason,
        isActive: row.isActive,
        createdByName: row.createdBy?.name ?? "Sistem",
        createdAt: iso(row.createdAt),
      })),
      total,
      query,
    );
  },
};

const transactions: TableDefinition = {
  roles: [...SUPER],
  searchHint: "nomor invoice, nama atau email pembayar, atau nama paket",
  async run(query) {
    const where: Prisma.TransactionWhereInput = query.q
      ? {
        OR: [
          { invoiceNumber: { contains: query.q } },
          { payerName: { contains: query.q } },
          { user: { name: { contains: query.q } } },
          { user: { email: { contains: query.q } } },
          { plan: { name: { contains: query.q } } },
        ],
      }
      : {};

    const total = await prisma.transaction.count({ where });
    const rows = await prisma.transaction.findMany({
      where,
      // Yang menunggu tinjauan didahulukan: tabel ini antrean kerja, bukan arsip.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: skipFor(query, total),
      take: query.pageSize,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        periodMonths: true,
        payerName: true,
        proofPath: true,
        submittedAt: true,
        reviewedAt: true,
        expiresAt: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, emailIsPlaceholder: true } },
        plan: { select: { name: true } },
        paymentMethod: { select: { label: true, channel: true } },
        reviewedBy: { select: { name: true } },
      },
    });

    return buildPage(
      rows.map(row => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        status: row.status,
        totalAmount: money(row.totalAmount),
        periodMonths: row.periodMonths,
        payerName: row.payerName,
        hasProof: row.proofPath !== null,
        userId: row.user.id,
        userName: row.user.name,
        userEmail: row.user.emailIsPlaceholder ? null : row.user.email,
        planName: row.plan.name,
        methodLabel: row.paymentMethod?.label ?? null,
        methodChannel: row.paymentMethod?.channel ?? null,
        reviewedByName: row.reviewedBy?.name ?? null,
        submittedAt: iso(row.submittedAt),
        reviewedAt: iso(row.reviewedAt),
        expiresAt: iso(row.expiresAt),
        createdAt: iso(row.createdAt),
      })),
      total,
      query,
    );
  },
};

const articles: TableDefinition = {
  roles: [...STAFF],
  searchHint: "judul, slug, atau ringkasan",
  async run(query) {
    const where: Prisma.ArticleWhereInput = query.q
      ? {
        OR: [
          { title: { contains: query.q } },
          { slug: { contains: query.q } },
          { excerpt: { contains: query.q } },
        ],
      }
      : {};

    const total = await prisma.article.count({ where });
    const rows = await prisma.article.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: skipFor(query, total),
      take: query.pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        scheduledFor: true,
        publishedAt: true,
        updatedAt: true,
        author: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    });

    return buildPage(
      rows.map(row => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status,
        authorName: row.author.name,
        approvedByName: row.approvedBy?.name ?? null,
        scheduledFor: iso(row.scheduledFor),
        publishedAt: iso(row.publishedAt),
        updatedAt: iso(row.updatedAt),
      })),
      total,
      query,
    );
  },
};

const connections: TableDefinition = {
  roles: [...SUPER],
  searchHint: "username Threads, nama atau email pemilik",
  async run(query) {
    const where: Prisma.ThreadsConnectionWhereInput = query.q
      ? {
        OR: [
          { username: { contains: query.q } },
          { externalAccountId: { contains: query.q } },
          { user: { name: { contains: query.q } } },
          { user: { email: { contains: query.q } } },
        ],
      }
      : {};

    const total = await prisma.threadsConnection.count({ where });
    const rows = await prisma.threadsConnection.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: skipFor(query, total),
      take: query.pageSize,
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
        user: { select: { id: true, name: true, email: true, emailIsPlaceholder: true } },
      },
    });

    // Pemakaian diambil sekali untuk pengguna pada halaman ini saja, bukan
    // untuk seluruh tabel MonthlyUsage seperti sebelumnya.
    const userIds = Array.from(new Set(rows.map(row => row.user.id)));
    const usage = userIds.length > 0
      ? await prisma.monthlyUsage.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _sum: { searchCount: true, replyCount: true },
      })
      : [];
    const usageByUser = new Map(usage.map(row => [row.userId, row._sum]));

    return buildPage(
      rows.map(row => ({
        id: row.id,
        username: row.username,
        status: row.status,
        capability: row.capability,
        tokenKind: row.tokenKind,
        tokenExpiresAt: iso(row.tokenExpiresAt),
        lastCheckedAt: iso(row.lastCheckedAt),
        lastErrorCode: row.lastErrorCode,
        userId: row.user.id,
        userName: row.user.name,
        userEmail: row.user.emailIsPlaceholder ? null : row.user.email,
        searchCount: usageByUser.get(row.user.id)?.searchCount ?? 0,
        replyCount: usageByUser.get(row.user.id)?.replyCount ?? 0,
        createdAt: iso(row.createdAt),
      })),
      total,
      query,
    );
  },
};

const credentials: TableDefinition = {
  roles: [...SUPER],
  searchHint: "nama perangkat, awalan token, nama atau email pemilik",
  async run(query) {
    const where: Prisma.ApiCredentialWhereInput = query.q
      ? {
        OR: [
          { name: { contains: query.q } },
          { keyPrefix: { contains: query.q } },
          { user: { name: { contains: query.q } } },
          { user: { email: { contains: query.q } } },
        ],
      }
      : {};

    const total = await prisma.apiCredential.count({ where });
    const rows = await prisma.apiCredential.findMany({
      where,
      orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
      skip: skipFor(query, total),
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        source: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
    });

    const now = Date.now();
    return buildPage(
      rows.map(row => ({
        id: row.id,
        name: row.name,
        keyPrefix: row.keyPrefix,
        source: row.source,
        userId: row.user.id,
        userName: row.user.name,
        issuedByName: row.createdBy?.name ?? null,
        state: row.revokedAt
          ? "REVOKED"
          : row.expiresAt && row.expiresAt.getTime() <= now
            ? "EXPIRED"
            : "ACTIVE",
        createdAt: iso(row.createdAt),
        lastUsedAt: iso(row.lastUsedAt),
        expiresAt: iso(row.expiresAt),
        revokedAt: iso(row.revokedAt),
      })),
      total,
      query,
    );
  },
};

export const TABLES = {
  users,
  admins,
  audit,
  contact,
  blacklist,
  transactions,
  articles,
  connections,
  credentials,
} satisfies Record<string, TableDefinition>;

export type TableResource = keyof typeof TABLES;

export function isTableResource(value: string): value is TableResource {
  return Object.hasOwn(TABLES, value);
}

/**
 * Menjalankan satu tabel setelah memeriksa peran pemanggil.
 *
 * Dipakai route API maupun halaman server, jadi halaman pertama yang dirender
 * di server dan halaman berikutnya yang diambil klien melewati pemeriksaan
 * yang sama persis.
 */
export async function runTable(resource: TableResource, role: Role, query: Partial<TableQuery>): Promise<TablePage> {
  const definition = TABLES[resource];
  if (!definition.roles.includes(role)) {
    throw new ThreadsIntegrationError("FORBIDDEN", "Anda tidak memiliki akses ke data ini.", 403);
  }
  return definition.run(normalizeQuery(query));
}

export function tableSearchHint(resource: TableResource) {
  return TABLES[resource].searchHint;
}
