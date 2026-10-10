/**
 * Penjadwalan pencarian berkala tanpa akses database.
 *
 * Paket menentukan jarak minimum antar pencarian (`searchIntervalHours`).
 * Pilihan pengguna hanya dapat membuat pencarian lebih jarang, tidak lebih
 * sering, sehingga jadwal selalu muat dalam kuota bulanan paketnya.
 */

export type ScheduleFrequency = "MANUAL" | "HOURLY" | "DAILY";

/** Tanpa paket aktif, tidak ada lantai interval selain satu jam. */
export const DEFAULT_PLAN_INTERVAL_HOURS = 1;

const FREQUENCY_INTERVAL_HOURS: Record<Exclude<ScheduleFrequency, "MANUAL">, number> = {
  HOURLY: 1,
  DAILY: 24,
};

export function effectiveIntervalHours(frequency: ScheduleFrequency, planIntervalHours: number | null | undefined): number | null {
  if (frequency === "MANUAL") return null;
  const planFloor = normalizeInterval(planIntervalHours);
  return Math.max(planFloor, FREQUENCY_INTERVAL_HOURS[frequency]);
}

function normalizeInterval(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return DEFAULT_PLAN_INTERVAL_HOURS;
  return Math.min(Math.trunc(value), 24 * 7);
}

/** Waktu pencarian berikutnya, atau null untuk kata kunci manual. */
export function nextRunAt(frequency: ScheduleFrequency, planIntervalHours: number | null | undefined, now = new Date()): Date | null {
  const interval = effectiveIntervalHours(frequency, planIntervalHours);
  return interval === null ? null : new Date(now.getTime() + interval * 60 * 60 * 1000);
}

/** Jumlah pencarian terjadwal per hari untuk satu kata kunci. */
export function runsPerDay(frequency: ScheduleFrequency, planIntervalHours: number | null | undefined): number {
  const interval = effectiveIntervalHours(frequency, planIntervalHours);
  return interval === null ? 0 : 24 / interval;
}

/** Proyeksi pemakaian kuota pencarian selama 30 hari. */
export function projectedMonthlySearches(
  keywords: Array<{ frequency: ScheduleFrequency }>,
  planIntervalHours: number | null | undefined,
  days = 30,
): number {
  const perDay = keywords.reduce((total, keyword) => total + runsPerDay(keyword.frequency, planIntervalHours), 0);
  return Math.round(perDay * days);
}
