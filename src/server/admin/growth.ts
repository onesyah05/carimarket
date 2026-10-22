import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Pertumbuhan pengguna dan pemakaian per bulan.
 *
 * PRD meminta grafik pertumbuhan di dashboard Superadmin, tetapi sampai
 * sekarang halaman itu hanya berisi angka hari ini — yang tidak menjawab
 * pertanyaan yang sebenarnya diajukan: apakah keadaannya membaik.
 *
 * Dua besaran dipisah ke dua grafik, bukan ditumpuk pada dua sumbu-Y: jumlah
 * akun baru dan jumlah permintaan ke Threads berbeda skala, dan satu gambar
 * dengan dua skala selalu dapat dibuat menunjukkan apa pun.
 */

const MONTHS = 12;

export type GrowthPoint = {
  /** Awal bulan dalam UTC, format YYYY-MM. */
  period: string;
  label: string;
  newUsers: number;
  searches: number;
  replies: number;
};

export type GrowthSeries = {
  points: GrowthPoint[];
  totals: { newUsers: number; searches: number; replies: number };
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Deretan bulan yang selalu lengkap, supaya bulan tanpa data tampil sebagai nol. */
function monthWindow(now = new Date()) {
  const months: Array<{ period: string; start: Date }> = [];
  for (let offset = MONTHS - 1; offset >= 0; offset -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    months.push({ period: monthKey(start), start });
  }
  return months;
}

const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function label(start: Date) {
  return `${MONTH_LABEL[start.getUTCMonth()]} ${String(start.getUTCFullYear()).slice(2)}`;
}

export async function loadGrowthSeries(): Promise<GrowthSeries> {
  const months = monthWindow();
  const since = months[0].start;

  // Akun dibaca sebagai daftar tanggal lalu dikelompokkan di aplikasi:
  // pengelompokan per bulan bukan sesuatu yang Prisma dapat lakukan tanpa SQL
  // mentah, dan jumlah barisnya masih kecil untuk rentang satu tahun.
  const [users, usage] = await Promise.all([
    prisma.user.findMany({
      where: { role: "USER", deletedAt: null, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.monthlyUsage.groupBy({
      by: ["periodStart"],
      where: { periodStart: { gte: since } },
      _sum: { searchCount: true, replyCount: true },
    }),
  ]);

  const usersByMonth = new Map<string, number>();
  for (const user of users) {
    const key = monthKey(user.createdAt);
    usersByMonth.set(key, (usersByMonth.get(key) ?? 0) + 1);
  }

  const usageByMonth = new Map<string, { searches: number; replies: number }>();
  for (const row of usage) {
    usageByMonth.set(monthKey(row.periodStart), {
      searches: row._sum.searchCount ?? 0,
      replies: row._sum.replyCount ?? 0,
    });
  }

  const points: GrowthPoint[] = months.map(month => {
    const usageRow = usageByMonth.get(month.period);
    return {
      period: month.period,
      label: label(month.start),
      newUsers: usersByMonth.get(month.period) ?? 0,
      searches: usageRow?.searches ?? 0,
      replies: usageRow?.replies ?? 0,
    };
  });

  return {
    points,
    totals: {
      newUsers: points.reduce((sum, point) => sum + point.newUsers, 0),
      searches: points.reduce((sum, point) => sum + point.searches, 0),
      replies: points.reduce((sum, point) => sum + point.replies, 0),
    },
  };
}
