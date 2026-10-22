import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

/**
 * Rate limit sederhana berbasis memori proses.
 *
 * Catatan operasional: hitungan ini tidak dibagi antar instance dan hilang saat
 * proses restart, jadi hanya efektif untuk satu proses Next.js (lihat README).
 * Entri kedaluwarsa dibersihkan agar map tidak tumbuh tanpa batas, dan jumlah
 * entri dibatasi agar lonjakan IP unik tidak menghabiskan memori.
 */

type Window = { count: number; resetAt: number };

const MAX_TRACKED_KEYS = 10_000;
const SWEEP_INTERVAL_MS = 60_000;

const windows = new Map<string, Window>();
let lastSweepAt = 0;

/**
 * Menolak permintaan yang datang dari halaman lain.
 *
 * Satu-satunya pertahanan lintas-situs untuk endpoint yang memakai cookie
 * sesi, jadi di produksi pemeriksaannya tidak boleh bisa hilang tanpa suara.
 * Dulu fungsi ini langsung lolos bila `Origin` kosong atau
 * `NEXT_PUBLIC_APP_URL` belum diisi; satu salah konfigurasi karena itu cukup
 * untuk mematikan proteksi seluruh aplikasi.
 *
 * Urutannya sekarang: `Origin` bila ada, lalu `Sec-Fetch-Site` sebagai
 * cadangan untuk permintaan yang memang tidak mengirim origin (mis. submit
 * form biasa di sebagian browser), dan gagal tertutup di produksi bila
 * keduanya tidak memberi keterangan apa pun.
 */
export function enforceSameOrigin(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const isProduction = process.env.NODE_ENV === "production";

  if (!appUrl) {
    // Di pengembangan ini hanya berarti .env belum lengkap; di produksi ini
    // berarti aplikasi berjalan tanpa pertahanan lintas-situs.
    if (!isProduction) return;
    throw new ThreadsIntegrationError(
      "ORIGIN_UNVERIFIABLE",
      "Permintaan tidak dapat diverifikasi karena alamat aplikasi belum dikonfigurasi. Hubungi administrator.",
      403,
      "NEXT_PUBLIC_APP_URL kosong di produksi",
    );
  }

  const configuredOrigin = new URL(appUrl).origin;
  const rejected = () => new ThreadsIntegrationError(
    "ORIGIN_REJECTED",
    // Pesannya menyebut penyebab yang paling sering: halaman dibuka lewat
    // http atau alamat lain, sehingga origin-nya berbeda dari alamat resmi.
    `Permintaan ditolak karena dikirim dari alamat yang berbeda. Buka ${configuredOrigin} lalu coba lagi.`,
    403,
  );

  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    const submittedOrigin = new URL(origin).origin;
    if (submittedOrigin === configuredOrigin) return;
    // Di pengembangan alamat yang dipakai browser sering berbeda dari yang
    // tertulis di .env (localhost vs alamat LAN vs https lokal).
    const developmentHost = isProduction ? null : request.headers.get("host");
    if (developmentHost && new URL(submittedOrigin).host === developmentHost) return;
    throw rejected();
  }

  // Tanpa Origin, browser modern masih menyebutkan asal permintaan di sini.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return;
  if (fetchSite) throw rejected();

  // Tidak ada keterangan sama sekali: klien non-browser (mis. curl, skrip
  // pemantauan) atau browser lama. Jalur ini dibiarkan di pengembangan agar
  // pengujian manual tetap praktis, tetapi ditutup di produksi karena endpoint
  // yang memakai cookie sesi tidak punya pertahanan lain.
  if (!isProduction) return;
  throw new ThreadsIntegrationError(
    "ORIGIN_UNVERIFIABLE",
    "Permintaan ditolak karena asalnya tidak dapat diverifikasi. Kirim permintaan dari aplikasi Cari Market.",
    403,
    "header Origin dan Sec-Fetch-Site tidak ada",
  );
}

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweep(now);

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) throw new ThreadsIntegrationError("RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi sebentar lagi.", 429);
  current.count += 1;
}

function sweep(now: number) {
  const overCapacity = windows.size > MAX_TRACKED_KEYS;
  if (!overCapacity && now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;

  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }

  // Masih penuh setelah pembersihan: buang entri terlama agar permintaan baru
  // tetap dapat dilayani, bukan gagal karena memori.
  if (windows.size > MAX_TRACKED_KEYS) {
    const excess = windows.size - MAX_TRACKED_KEYS;
    let removed = 0;
    for (const key of windows.keys()) {
      windows.delete(key);
      removed += 1;
      if (removed >= excess) break;
    }
  }
}

/** Hanya dipakai pengujian agar setiap kasus mulai dari kondisi bersih. */
export function resetRateLimits() {
  windows.clear();
  lastSweepAt = 0;
}

export function rateLimitSize() {
  return windows.size;
}
