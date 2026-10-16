import type { Role } from "@prisma/client";

/**
 * Aturan akses ruang kerja: verifikasi email lalu langganan.
 *
 * Murni dan tanpa database supaya setiap cabangnya dapat diuji — termasuk
 * cabang tenggang yang baru terasa akibatnya berminggu-minggu kemudian.
 */

/**
 * Sejak kapan kewajiban memilih paket berlaku.
 *
 * Akun yang dibuat pada atau setelah tanggal ini langsung terkena aturan.
 * Akun yang lebih lama memakai aplikasi sebelum aturan ada, jadi mereka diberi
 * tenggang: mencabut akses tanpa pemberitahuan bukan cara memperlakukan
 * pelanggan yang sudah berjalan.
 */
export const PAYWALL_FROM = new Date("2026-10-16T00:00:00.000Z");

export const GRACE_DAYS = 14;

export const GRACE_ENDS_AT = new Date(PAYWALL_FROM.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);

export const VERIFY_PATH = "/verifikasi/menunggu";
export const PLAN_PATH = "/mulai/paket";

export type AccessInput = {
  role: Role;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";
  createdAt: Date;
  hasActiveSubscription: boolean;
};

export type AccessDecision =
  | {
    allowed: true;
    /** Terisi bila akses masih berjalan hanya karena tenggang pengguna lama. */
    grace: { endsAt: Date; daysLeft: number } | null;
  }
  | {
    allowed: false;
    redirectTo: string;
    code: "EMAIL_NOT_VERIFIED" | "SUBSCRIPTION_REQUIRED";
    message: string;
  };

function daysUntil(target: Date, now: Date) {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

export function decideAccess(input: AccessInput, now = new Date()): AccessDecision {
  // Tim internal tidak berlangganan apa pun; konsol mereka bukan ruang kerja.
  if (input.role !== "USER") return { allowed: true, grace: null };

  if (input.status === "PENDING_VERIFICATION") {
    return {
      allowed: false,
      redirectTo: VERIFY_PATH,
      code: "EMAIL_NOT_VERIFIED",
      message: "Verifikasi email Anda dulu untuk membuka ruang kerja.",
    };
  }

  if (input.hasActiveSubscription) return { allowed: true, grace: null };

  const legacy = input.createdAt.getTime() < PAYWALL_FROM.getTime();
  if (legacy && now.getTime() < GRACE_ENDS_AT.getTime()) {
    return { allowed: true, grace: { endsAt: GRACE_ENDS_AT, daysLeft: daysUntil(GRACE_ENDS_AT, now) } };
  }

  return {
    allowed: false,
    redirectTo: PLAN_PATH,
    code: "SUBSCRIPTION_REQUIRED",
    message: "Pilih paket langganan dulu untuk membuka ruang kerja.",
  };
}
