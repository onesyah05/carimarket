/**
 * Perhitungan kuota tanpa akses database.
 *
 * Batas bernilai nol atau negatif diartikan "tanpa batas" agar paket yang
 * belum menetapkan angka tidak memblokir pengguna secara tidak sengaja.
 */

export const QUOTA_WARNING_RATIO = 0.8;

export type PlanLimits = {
  monthlySearchLimit: number;
  monthlyReplyLimit: number;
  keywordLimit: number;
};

export type QuotaCheck = {
  used: number;
  limit: number | null;
  remaining: number | null;
  allowed: boolean;
  warning: boolean;
  percentage: number | null;
};

export function evaluateQuota(used: number, limit: number | null | undefined): QuotaCheck {
  const safeUsed = Math.max(0, Math.trunc(used));
  if (limit === null || limit === undefined || limit <= 0) {
    return { used: safeUsed, limit: null, remaining: null, allowed: true, warning: false, percentage: null };
  }
  const remaining = Math.max(0, limit - safeUsed);
  const percentage = Math.min(100, Math.round((safeUsed / limit) * 100));
  return {
    used: safeUsed,
    limit,
    remaining,
    allowed: safeUsed < limit,
    warning: safeUsed >= limit * QUOTA_WARNING_RATIO,
    percentage,
  };
}

/** Awal periode penagihan bulan berjalan dalam UTC. */
export function currentPeriodStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
