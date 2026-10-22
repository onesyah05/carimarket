import { afterEach, describe, expect, it } from "vitest";
import {
  META_DAILY_REPLY_LIMIT,
  META_DAILY_SEARCH_LIMIT,
  currentUsageDay,
  platformDailyReplyLimit,
  platformDailySearchLimit,
} from "./platform-limits";

describe("batas harian platform", () => {
  const originalSearch = process.env.PLATFORM_DAILY_SEARCH_LIMIT;
  const originalReply = process.env.PLATFORM_DAILY_REPLY_LIMIT;

  afterEach(() => {
    if (originalSearch === undefined) delete process.env.PLATFORM_DAILY_SEARCH_LIMIT;
    else process.env.PLATFORM_DAILY_SEARCH_LIMIT = originalSearch;
    if (originalReply === undefined) delete process.env.PLATFORM_DAILY_REPLY_LIMIT;
    else process.env.PLATFORM_DAILY_REPLY_LIMIT = originalReply;
  });

  it("bawaannya berada di bawah batas Meta", () => {
    delete process.env.PLATFORM_DAILY_SEARCH_LIMIT;
    delete process.env.PLATFORM_DAILY_REPLY_LIMIT;
    expect(platformDailySearchLimit()).toBeLessThan(META_DAILY_SEARCH_LIMIT);
    expect(platformDailyReplyLimit()).toBeLessThan(META_DAILY_REPLY_LIMIT);
  });

  it("dapat ditimpa operator lewat environment", () => {
    process.env.PLATFORM_DAILY_SEARCH_LIMIT = "4400";
    process.env.PLATFORM_DAILY_REPLY_LIMIT = "1800";
    expect(platformDailySearchLimit()).toBe(4_400);
    expect(platformDailyReplyLimit()).toBe(1_800);
  });

  it("mengabaikan nilai environment yang tidak masuk akal", () => {
    for (const value of ["0", "-5", "bukan angka", ""]) {
      process.env.PLATFORM_DAILY_SEARCH_LIMIT = value;
      expect(platformDailySearchLimit()).toBe(2_000);
    }
  });

  it("memotong nilai berkoma menjadi bilangan bulat", () => {
    process.env.PLATFORM_DAILY_REPLY_LIMIT = "950.7";
    expect(platformDailyReplyLimit()).toBe(950);
  });
});

describe("currentUsageDay", () => {
  it("memakai awal hari UTC, bukan zona waktu server", () => {
    // 23:30 di Jakarta (UTC+7) masih tanggal 21 menurut UTC.
    const day = currentUsageDay(new Date("2026-10-22T16:30:00.000Z"));
    expect(day.toISOString()).toBe("2026-10-22T00:00:00.000Z");
    const earlier = currentUsageDay(new Date("2026-10-21T23:59:59.999Z"));
    expect(earlier.toISOString()).toBe("2026-10-21T00:00:00.000Z");
  });

  it("menghasilkan nilai yang sama untuk dua waktu di hari UTC yang sama", () => {
    const pagi = currentUsageDay(new Date("2026-10-22T00:00:01.000Z"));
    const malam = currentUsageDay(new Date("2026-10-22T23:59:59.000Z"));
    expect(pagi.getTime()).toBe(malam.getTime());
  });
});
