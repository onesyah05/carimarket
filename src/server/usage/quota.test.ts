import { describe, expect, it } from "vitest";
import { currentPeriodStart, evaluateQuota, QUOTA_WARNING_RATIO } from "./quota";

describe("evaluateQuota", () => {
  it("menganggap batas nol atau negatif sebagai tanpa batas", () => {
    for (const limit of [0, -5, null, undefined]) {
      const check = evaluateQuota(120, limit);
      expect(check.allowed).toBe(true);
      expect(check.limit).toBeNull();
      expect(check.remaining).toBeNull();
      expect(check.warning).toBe(false);
    }
  });

  it("menghitung sisa dan persentase pemakaian", () => {
    const check = evaluateQuota(25, 100);
    expect(check.remaining).toBe(75);
    expect(check.percentage).toBe(25);
    expect(check.allowed).toBe(true);
  });

  it("menolak saat pemakaian mencapai batas", () => {
    expect(evaluateQuota(99, 100).allowed).toBe(true);
    expect(evaluateQuota(100, 100).allowed).toBe(false);
    expect(evaluateQuota(101, 100).allowed).toBe(false);
  });

  it("memberi peringatan mulai dari ambang 80 persen", () => {
    expect(evaluateQuota(79, 100).warning).toBe(false);
    expect(evaluateQuota(Math.ceil(100 * QUOTA_WARNING_RATIO), 100).warning).toBe(true);
  });

  it("tidak pernah melaporkan sisa negatif", () => {
    const check = evaluateQuota(150, 100);
    expect(check.remaining).toBe(0);
    expect(check.percentage).toBe(100);
  });

  it("membulatkan pemakaian ke bilangan bulat tak negatif", () => {
    expect(evaluateQuota(-3, 10).used).toBe(0);
    expect(evaluateQuota(4.7, 10).used).toBe(4);
  });
});

describe("currentPeriodStart", () => {
  it("mengembalikan awal bulan dalam UTC", () => {
    expect(currentPeriodStart(new Date("2026-10-10T23:30:00.000Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("stabil pada hari pertama bulan", () => {
    expect(currentPeriodStart(new Date("2026-01-01T00:00:00.000Z")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
