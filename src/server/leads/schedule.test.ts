import { describe, expect, it } from "vitest";
import { effectiveIntervalHours, nextRunAt, projectedMonthlySearches, runsPerDay } from "./schedule";

describe("effectiveIntervalHours", () => {
  it("memakai interval paket sebagai lantai, bukan pilihan pengguna", () => {
    // Pengguna memilih tiap jam, paket Starter hanya mengizinkan sekali sehari.
    expect(effectiveIntervalHours("HOURLY", 24)).toBe(24);
    expect(effectiveIntervalHours("HOURLY", 6)).toBe(6);
    expect(effectiveIntervalHours("HOURLY", 3)).toBe(3);
  });

  it("menghormati pilihan pengguna yang lebih jarang dari paket", () => {
    expect(effectiveIntervalHours("DAILY", 3)).toBe(24);
    expect(effectiveIntervalHours("DAILY", 6)).toBe(24);
  });

  it("mengembalikan null untuk kata kunci manual", () => {
    expect(effectiveIntervalHours("MANUAL", 3)).toBeNull();
    expect(effectiveIntervalHours("MANUAL", null)).toBeNull();
  });

  it("memakai bawaan satu jam saat tidak ada paket aktif", () => {
    expect(effectiveIntervalHours("HOURLY", null)).toBe(1);
    expect(effectiveIntervalHours("HOURLY", undefined)).toBe(1);
    expect(effectiveIntervalHours("HOURLY", 0)).toBe(1);
    expect(effectiveIntervalHours("HOURLY", -5)).toBe(1);
  });

  it("membatasi interval tidak lebih dari satu minggu", () => {
    expect(effectiveIntervalHours("HOURLY", 10_000)).toBe(168);
  });
});

describe("nextRunAt", () => {
  const now = new Date("2026-10-10T10:00:00.000Z");

  it("menjadwalkan sesuai interval paket", () => {
    expect(nextRunAt("HOURLY", 6, now)?.toISOString()).toBe("2026-10-10T16:00:00.000Z");
    expect(nextRunAt("HOURLY", 24, now)?.toISOString()).toBe("2026-10-11T10:00:00.000Z");
    expect(nextRunAt("DAILY", 3, now)?.toISOString()).toBe("2026-10-11T10:00:00.000Z");
  });

  it("tidak menjadwalkan kata kunci manual", () => {
    expect(nextRunAt("MANUAL", 6, now)).toBeNull();
  });
});

describe("runsPerDay", () => {
  it("menghitung jumlah eksekusi harian", () => {
    expect(runsPerDay("HOURLY", 24)).toBe(1);
    expect(runsPerDay("HOURLY", 6)).toBe(4);
    expect(runsPerDay("HOURLY", 3)).toBe(8);
    expect(runsPerDay("HOURLY", 1)).toBe(24);
    expect(runsPerDay("MANUAL", 3)).toBe(0);
  });
});

describe("projectedMonthlySearches", () => {
  it("menjumlahkan proyeksi seluruh kata kunci terjadwal", () => {
    const keywords = [{ frequency: "HOURLY" as const }, { frequency: "HOURLY" as const }, { frequency: "DAILY" as const }];
    // Paket tiap 6 jam: dua kata kunci 4x/hari dan satu 1x/hari = 9 per hari.
    expect(projectedMonthlySearches(keywords, 6)).toBe(9 * 30);
  });

  it("mengabaikan kata kunci manual", () => {
    expect(projectedMonthlySearches([{ frequency: "MANUAL" as const }], 3)).toBe(0);
  });

  it("menghasilkan nol untuk daftar kosong", () => {
    expect(projectedMonthlySearches([], 3)).toBe(0);
  });
});
