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

export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || !appUrl) return;
  const submittedOrigin = new URL(origin).origin;
  const configuredOrigin = new URL(appUrl).origin;
  const developmentHost = process.env.NODE_ENV === "development" ? request.headers.get("host") : null;
  if (submittedOrigin !== configuredOrigin && new URL(submittedOrigin).host !== developmentHost) {
    throw new ThreadsIntegrationError("ORIGIN_REJECTED", "Origin permintaan tidak diizinkan.", 403);
  }
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
