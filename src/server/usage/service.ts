import "server-only";
import { prisma } from "@/lib/prisma";
// Periode penagihan dipakai bersama penegakan kuota; jangan didefinisikan ulang
// di sini agar penghitung dan pemeriksa selalu membaca baris yang sama.
import { currentPeriodStart } from "./quota";
import { currentUsageDay, platformDailyReplyLimit, platformDailySearchLimit } from "./platform-limits";

export type UsageType = "SEARCH" | "REPLY";

/**
 * Pencatatan pemakaian.
 *
 * Dulu urutannya "periksa kuota, jalankan aksi, lalu catat", dan pencatatannya
 * menelan kegagalan tulis. Dua permintaan bersamaan karena itu sama-sama lolos
 * pemeriksaan, dan pemakaian yang gagal tercatat berarti batas paket tidak
 * pernah tercapai. Untuk kuota yang plafonnya adalah batas keras Meta, itu
 * bukan ketidakakuratan kecil.
 *
 * Sekarang jatah dipesan lebih dulu lewat satu pernyataan UPDATE bersyarat,
 * sehingga databaselah yang memutuskan siapa yang kebagian. Aksi yang gagal
 * mengembalikan jatahnya.
 */

function warnUsageFailure(type: UsageType, scope: string, error: unknown) {
  const reason = error instanceof Error ? error.message.slice(0, 200) : "penyebab tidak diketahui";
  console.warn(`Pencatatan pemakaian ${type} gagal pada ${scope}: ${reason}`);
}

export type ReservationResult =
  | { ok: true }
  | { ok: false; scope: "workspace" | "platform" };

const MONTHLY_FIELD = { SEARCH: "searchCount", REPLY: "replyCount" } as const;

/** Memastikan baris penghitung ada, supaya UPDATE bersyarat punya sasaran. */
async function ensureRows(userId: string, periodStart: Date, day: Date) {
  await Promise.all([
    prisma.monthlyUsage.upsert({
      where: { userId_periodStart: { userId, periodStart } },
      update: {},
      create: { userId, periodStart, searchCount: 0, replyCount: 0 },
    }),
    prisma.platformDailyUsage.upsert({
      where: { day },
      update: {},
      create: { day, searchCount: 0, replyCount: 0 },
    }),
  ]);
}

/**
 * Memesan satu satuan pemakaian.
 *
 * `limit` null berarti paket tidak membatasi; penghitungnya tetap dinaikkan
 * agar laporan pemakaian tetap benar. Batas platform selalu berlaku, termasuk
 * untuk paket tanpa batas, karena yang dilindunginya bukan paket melainkan
 * akun Threads yang dipakai bersama.
 */
export async function reserveUsage(userId: string, type: UsageType, limit: number | null): Promise<ReservationResult> {
  const periodStart = currentPeriodStart();
  const day = currentUsageDay();
  const field = MONTHLY_FIELD[type];
  const platformLimit = type === "SEARCH" ? platformDailySearchLimit() : platformDailyReplyLimit();

  await ensureRows(userId, periodStart, day);

  const workspace = await prisma.monthlyUsage.updateMany({
    where: {
      userId,
      periodStart,
      ...(limit === null ? {} : { [field]: { lt: limit } }),
    },
    data: { [field]: { increment: 1 } },
  });
  if (!workspace.count) return { ok: false, scope: "workspace" };

  const platform = await prisma.platformDailyUsage.updateMany({
    where: { day, [field]: { lt: platformLimit } },
    data: { [field]: { increment: 1 } },
  });
  if (!platform.count) {
    // Jatah workspace dikembalikan supaya pengguna tidak kehilangan kuota
    // karena batas yang bukan miliknya.
    await prisma.monthlyUsage.updateMany({
      where: { userId, periodStart, [field]: { gt: 0 } },
      data: { [field]: { decrement: 1 } },
    }).catch(error => warnUsageFailure(type, "pengembalian MonthlyUsage", error));
    return { ok: false, scope: "platform" };
  }

  return { ok: true };
}

/** Mengembalikan jatah yang sudah dipesan ketika aksinya akhirnya gagal. */
export async function releaseUsage(userId: string, type: UsageType) {
  const periodStart = currentPeriodStart();
  const day = currentUsageDay();
  const field = MONTHLY_FIELD[type];

  await Promise.all([
    prisma.monthlyUsage.updateMany({
      where: { userId, periodStart, [field]: { gt: 0 } },
      data: { [field]: { decrement: 1 } },
    }),
    prisma.platformDailyUsage.updateMany({
      where: { day, [field]: { gt: 0 } },
      data: { [field]: { decrement: 1 } },
    }),
  ]).catch(error => warnUsageFailure(type, "pengembalian jatah", error));
}

/**
 * Jejak pemakaian yang dapat diaudit. Dipisah dari pemesanan jatah karena
 * kegagalan menulis jejak tidak boleh membatalkan aksi yang sudah berhasil —
 * sedangkan kegagalan memesan jatah memang harus membatalkannya.
 */
export async function logUsageEvent(userId: string, type: UsageType, units = 1, referenceId?: string) {
  await prisma.usageEvent.create({
    data: { userId, type, units, referenceId: referenceId ?? null, occurredAt: new Date() },
  }).catch(error => warnUsageFailure(type, "UsageEvent", error));
}

/** Pemakaian platform hari ini, untuk panel kuota Superadmin. */
export async function platformUsageToday() {
  const day = currentUsageDay();
  const row = await prisma.platformDailyUsage.findUnique({ where: { day } });
  return {
    day: day.toISOString().slice(0, 10),
    search: { used: row?.searchCount ?? 0, limit: platformDailySearchLimit() },
    reply: { used: row?.replyCount ?? 0, limit: platformDailyReplyLimit() },
  };
}
