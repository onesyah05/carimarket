import { describe, expect, it } from "vitest";
import { PLAN_CATALOG, findPlan } from "../../../prisma/plan-catalog";

/** Batas Meta per akun Threads yang terhubung, per 24 jam. */
const META_DAILY_SEARCH_LIMIT = 2_200;
const META_DAILY_REPLY_LIMIT = 1_000;
const DAYS_IN_MONTH = 30;

describe("katalog paket", () => {
  it("memuat paket gratis beserta dua paket berbayar yang diminta", () => {
    expect(PLAN_CATALOG.map(plan => plan.monthlyPrice)).toEqual([0, 98_000, 149_000]);
    expect(findPlan("BISNIS")?.monthlyPrice).toBe(98_000);
    expect(findPlan("PRO")?.monthlyPrice).toBe(149_000);
  });

  it("memakai kode unik", () => {
    expect(new Set(PLAN_CATALOG.map(plan => plan.code)).size).toBe(PLAN_CATALOG.length);
  });

  it("menaikkan harga dan seluruh kuota secara konsisten", () => {
    for (let index = 1; index < PLAN_CATALOG.length; index += 1) {
      const lower = PLAN_CATALOG[index - 1];
      const higher = PLAN_CATALOG[index];
      expect(higher.monthlyPrice).toBeGreaterThan(lower.monthlyPrice);
      expect(higher.monthlySearchLimit).toBeGreaterThan(lower.monthlySearchLimit);
      expect(higher.monthlyReplyLimit).toBeGreaterThan(lower.monthlyReplyLimit);
      expect(higher.keywordLimit).toBeGreaterThan(lower.keywordLimit);
    }
  });

  it("menjaga kuota harian tetap di bawah batas Meta", () => {
    for (const plan of PLAN_CATALOG) {
      expect(plan.monthlySearchLimit / DAYS_IN_MONTH).toBeLessThan(META_DAILY_SEARCH_LIMIT);
      expect(plan.monthlyReplyLimit / DAYS_IN_MONTH).toBeLessThan(META_DAILY_REPLY_LIMIT);
    }
  });

  it("menyediakan pencarian yang cukup untuk seluruh kata kunci paket", () => {
    // Minimal setara satu pencarian harian per kata kunci selama sebulan.
    for (const plan of PLAN_CATALOG) {
      expect(plan.monthlySearchLimit).toBeGreaterThanOrEqual(plan.keywordLimit * DAYS_IN_MONTH);
    }
  });

  it("menyertakan satu paket gratis sebagai batas bawaan", () => {
    expect(PLAN_CATALOG.filter(plan => plan.monthlyPrice === 0)).toHaveLength(1);
  });

  it("menandai tepat satu paket sebagai pilihan utama", () => {
    expect(PLAN_CATALOG.filter(plan => plan.featured)).toHaveLength(1);
  });

  it("melengkapi setiap paket dengan tagline dan keunggulan", () => {
    for (const plan of PLAN_CATALOG) {
      expect(plan.tagline.length).toBeGreaterThan(20);
      expect(plan.highlights.length).toBeGreaterThanOrEqual(4);
    }
  });
});
