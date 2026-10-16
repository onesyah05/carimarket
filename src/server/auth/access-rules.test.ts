import { describe, expect, it } from "vitest";
import { GRACE_ENDS_AT, PAYWALL_FROM, PLAN_PATH, VERIFY_PATH, decideAccess, type AccessInput } from "./access-rules";

const BEFORE = new Date(PAYWALL_FROM.getTime() - 30 * 24 * 60 * 60 * 1000);
const AFTER = new Date(PAYWALL_FROM.getTime() + 60_000);

function input(overrides: Partial<AccessInput> = {}): AccessInput {
  return { role: "USER", status: "ACTIVE", createdAt: AFTER, hasActiveSubscription: false, ...overrides };
}

describe("decideAccess", () => {
  it("menahan akun yang emailnya belum terverifikasi", () => {
    const decision = decideAccess(input({ status: "PENDING_VERIFICATION" }));
    expect(decision).toMatchObject({ allowed: false, redirectTo: VERIFY_PATH, code: "EMAIL_NOT_VERIFIED" });
  });

  it("mendahulukan verifikasi di atas langganan", () => {
    // Akun bisa saja sudah punya langganan dari jalur lain; email tetap harus
    // terbukti miliknya sebelum ruang kerja terbuka.
    const decision = decideAccess(input({ status: "PENDING_VERIFICATION", hasActiveSubscription: true }));
    expect(decision).toMatchObject({ allowed: false, code: "EMAIL_NOT_VERIFIED" });
  });

  it("mengizinkan akun berlangganan", () => {
    expect(decideAccess(input({ hasActiveSubscription: true }))).toEqual({ allowed: true, grace: null });
  });

  it("menahan pendaftar baru yang belum memilih paket", () => {
    const decision = decideAccess(input());
    expect(decision).toMatchObject({ allowed: false, redirectTo: PLAN_PATH, code: "SUBSCRIPTION_REQUIRED" });
  });

  it("memberi tenggang kepada akun lama yang belum berlangganan", () => {
    const now = new Date(PAYWALL_FROM.getTime() + 3 * 24 * 60 * 60 * 1000);
    const decision = decideAccess(input({ createdAt: BEFORE }), now);
    expect(decision.allowed).toBe(true);
    expect(decision.allowed && decision.grace).toMatchObject({ daysLeft: 11 });
  });

  it("menutup akses akun lama setelah tenggang habis", () => {
    const now = new Date(GRACE_ENDS_AT.getTime() + 60_000);
    expect(decideAccess(input({ createdAt: BEFORE }), now)).toMatchObject({ allowed: false, code: "SUBSCRIPTION_REQUIRED" });
  });

  it("tidak memberi tenggang kepada akun yang dibuat setelah aturan berlaku", () => {
    const now = new Date(PAYWALL_FROM.getTime() + 24 * 60 * 60 * 1000);
    expect(decideAccess(input({ createdAt: AFTER }), now)).toMatchObject({ allowed: false });
  });

  it("melewatkan akun internal tanpa syarat apa pun", () => {
    for (const role of ["ADMIN", "SUPERADMIN"] as const) {
      expect(decideAccess(input({ role, status: "PENDING_VERIFICATION" }))).toEqual({ allowed: true, grace: null });
    }
  });

  it("melaporkan sisa hari nol tepat saat tenggang berakhir", () => {
    const decision = decideAccess(input({ createdAt: BEFORE }), new Date(GRACE_ENDS_AT.getTime() - 1));
    expect(decision.allowed && decision.grace?.daysLeft).toBe(1);
  });
});
