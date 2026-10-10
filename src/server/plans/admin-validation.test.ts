import { describe, expect, it } from "vitest";
import { planQuotaIssues } from "./admin";

const base = { monthlySearchLimit: 2_000, monthlyReplyLimit: 300, keywordLimit: 10, searchIntervalHours: 6 };

describe("planQuotaIssues", () => {
  it("menerima kombinasi yang jadwalnya muat dalam kuota", () => {
    expect(planQuotaIssues(base)).toEqual([]);
  });

  it("menolak jadwal yang melampaui kuota pencarian", () => {
    // 10 kata kunci tiap jam = 7.200 per bulan, di atas kuota 2.000.
    const issues = planQuotaIssues({ ...base, searchIntervalHours: 1 });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain("7.200");
    expect(issues[0]).toContain("kuota 2.000");
  });

  it("menolak pemakaian harian di atas batas pencarian Meta", () => {
    const issues = planQuotaIssues({ monthlySearchLimit: 0, monthlyReplyLimit: 0, keywordLimit: 100, searchIntervalHours: 1 });
    expect(issues.some(issue => issue.includes("2.200"))).toBe(true);
  });

  it("menolak kuota balasan di atas batas harian Meta", () => {
    const issues = planQuotaIssues({ ...base, monthlyReplyLimit: 40_000 });
    expect(issues.some(issue => issue.includes("1.000"))).toBe(true);
  });

  it("memperlakukan batas nol sebagai tanpa batas", () => {
    expect(planQuotaIssues({ monthlySearchLimit: 0, monthlyReplyLimit: 0, keywordLimit: 3, searchIntervalHours: 24 })).toEqual([]);
  });

  it("menerima paket tanpa kata kunci sama sekali", () => {
    expect(planQuotaIssues({ ...base, keywordLimit: 0 })).toEqual([]);
  });

  it("menerima katalog bawaan tiga paket", () => {
    const catalog = [
      { monthlySearchLimit: 300, monthlyReplyLimit: 30, keywordLimit: 3, searchIntervalHours: 24 },
      { monthlySearchLimit: 2_000, monthlyReplyLimit: 300, keywordLimit: 10, searchIntervalHours: 6 },
      { monthlySearchLimit: 6_000, monthlyReplyLimit: 800, keywordLimit: 25, searchIntervalHours: 3 },
    ];
    for (const plan of catalog) expect(planQuotaIssues(plan), JSON.stringify(plan)).toEqual([]);
  });
});
