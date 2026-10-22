import "server-only";

/**
 * Batas pemakaian tingkat platform per 24 jam.
 *
 * Batas Meta berlaku per akun Threads yang terhubung — 2.200 pencarian kata
 * kunci dan sekitar 1.000 balasan per 24 jam. Pada jalur pra-App-Review
 * seluruh pencarian pelanggan berjalan lewat satu sesi web milik Superadmin,
 * jadi batas itu praktis menjadi batas bersama: tanpa hitungan di tingkat
 * platform, lonjakan satu hari dapat memblokir sesi tersebut dan mematikan
 * pencarian untuk semua pelanggan sekaligus.
 *
 * Angkanya ditaruh di bawah batas Meta, bukan tepat di batasnya. Sisa itu
 * ruang untuk permintaan yang tidak terhitung di sini: uji koneksi, konsol
 * pencarian Superadmin, dan percobaan ulang pada kegagalan sementara.
 */

export const META_DAILY_SEARCH_LIMIT = 2_200;
export const META_DAILY_REPLY_LIMIT = 1_000;

/** Dapat ditimpa operator bila akun Threads yang dipakai memang lebih dari satu. */
function envLimit(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : fallback;
}

export function platformDailySearchLimit() {
  return envLimit("PLATFORM_DAILY_SEARCH_LIMIT", 2_000);
}

export function platformDailyReplyLimit() {
  return envLimit("PLATFORM_DAILY_REPLY_LIMIT", 900);
}

/** Awal hari UTC, dipakai sebagai kunci baris harian. */
export function currentUsageDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
