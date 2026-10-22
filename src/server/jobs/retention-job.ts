import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Pembersihan data operasional.
 *
 * Tidak ada satu pun tabel berumur pendek yang pernah dibersihkan: sesi
 * kedaluwarsa, token verifikasi dan pengaturan ulang yang sudah terpakai, kode
 * pemasangan basi, kunci job yang ditinggalkan, serta jejak pemakaian lama
 * hanya menumpuk. Pada VPS satu mesin, tabel yang tumbuh selamanya akhirnya
 * memperlambat query yang justru dijalankan paling sering.
 *
 * Yang sengaja TIDAK dibersihkan: `AuditLog`, `Transaction`, `Subscription`,
 * `Lead`, dan `ReplyDraft`. Keempat yang pertama catatan finansial dan
 * kepatuhan yang memang harus dipertahankan; dua yang terakhir adalah isi
 * ruang kerja pelanggan, bukan data sementara.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Jejak pemakaian per peristiwa; agregat bulanannya tetap disimpan. */
const USAGE_EVENT_RETENTION_DAYS = 180;

/** Hitungan harian platform hanya menarik untuk beberapa bulan terakhir. */
const DAILY_USAGE_RETENTION_DAYS = 120;

/** Notifikasi yang sudah dibaca dan sudah lama tidak lagi dibuka siapa pun. */
const READ_NOTIFICATION_RETENTION_DAYS = 90;

/**
 * Postingan Threads yang tidak lagi tertaut ke lead mana pun. Snapshot publik
 * seperti ini tidak punya nilai tanpa lead-nya, dan menyimpannya tanpa batas
 * berarti menyimpan data orang lain lebih lama dari yang diperlukan.
 */
const ORPHAN_POST_RETENTION_DAYS = 30;

export type RetentionSummary = {
  retentionSessions: number;
  retentionTokens: number;
  retentionPairingCodes: number;
  retentionJobLocks: number;
  retentionUsageEvents: number;
  retentionDailyUsage: number;
  retentionNotifications: number;
  retentionOrphanPosts: number;
};

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

export async function pruneExpiredRecords(): Promise<RetentionSummary> {
  const now = new Date();

  const [sessions, verifications, resets, pairingCodes, jobLocks, usageEvents, dailyUsage, notifications] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lte: now } } }),
    // Token yang sudah terpakai maupun yang sudah lewat tidak dapat dipakai
    // lagi, jadi tidak ada alasan menyimpannya.
    prisma.emailVerificationToken.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { consumedAt: { not: null } }] },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { consumedAt: { not: null } }] },
    }),
    prisma.mobilePairingCode.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] },
    }),
    prisma.jobLock.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.usageEvent.deleteMany({ where: { occurredAt: { lt: daysAgo(USAGE_EVENT_RETENTION_DAYS) } } }),
    prisma.platformDailyUsage.deleteMany({ where: { day: { lt: daysAgo(DAILY_USAGE_RETENTION_DAYS) } } }),
    prisma.notification.deleteMany({
      where: { readAt: { not: null }, createdAt: { lt: daysAgo(READ_NOTIFICATION_RETENTION_DAYS) } },
    }),
  ]);

  // Dijalankan terpisah karena bergantung pada relasi, bukan hanya waktu.
  const orphanPosts = await prisma.threadPost.deleteMany({
    where: {
      capturedAt: { lt: daysAgo(ORPHAN_POST_RETENTION_DAYS) },
      leads: { none: {} },
    },
  }).catch(() => ({ count: 0 }));

  return {
    retentionSessions: sessions.count,
    retentionTokens: verifications.count + resets.count,
    retentionPairingCodes: pairingCodes.count,
    retentionJobLocks: jobLocks.count,
    retentionUsageEvents: usageEvents.count,
    retentionDailyUsage: dailyUsage.count,
    retentionNotifications: notifications.count,
    retentionOrphanPosts: orphanPosts.count,
  };
}
