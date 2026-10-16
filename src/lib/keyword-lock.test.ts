import { describe, expect, it } from "vitest";
import { KEYWORD_LOCK_HOURS, isKeywordLocked, keywordUnlockAt, lockRemainingLabel } from "./keyword-lock";

const CREATED = new Date("2026-10-17T08:00:00.000Z");
const hours = (value: number) => CREATED.getTime() + value * 60 * 60 * 1000;

describe("keywordUnlockAt", () => {
  it("membuka tepat 24 jam setelah dibuat", () => {
    expect(keywordUnlockAt(CREATED).toISOString()).toBe("2026-10-18T08:00:00.000Z");
    expect(KEYWORD_LOCK_HOURS).toBe(24);
  });

  it("menerima tanggal dalam bentuk teks", () => {
    expect(keywordUnlockAt(CREATED.toISOString()).getTime()).toBe(hours(24));
  });
});

describe("isKeywordLocked", () => {
  it("terkunci sepanjang 24 jam pertama", () => {
    expect(isKeywordLocked(CREATED, hours(0))).toBe(true);
    expect(isKeywordLocked(CREATED, hours(23.9))).toBe(true);
  });

  it("terbuka tepat pada jam ke-24", () => {
    expect(isKeywordLocked(CREATED, hours(24))).toBe(false);
  });

  it("terbuka setelahnya", () => {
    expect(isKeywordLocked(CREATED, hours(100))).toBe(false);
  });
});

describe("lockRemainingLabel", () => {
  it("menyebut sisa jam, dibulatkan ke atas", () => {
    expect(lockRemainingLabel(CREATED, hours(21.5))).toBe("3 jam lagi");
  });

  it("beralih ke menit di bawah satu jam", () => {
    expect(lockRemainingLabel(CREATED, hours(23.5))).toBe("30 menit lagi");
  });

  it("menyatakan sudah terbuka ketika masanya lewat", () => {
    expect(lockRemainingLabel(CREATED, hours(30))).toBe("sudah bisa diubah");
  });
});
