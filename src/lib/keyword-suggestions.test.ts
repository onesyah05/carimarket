import { describe, expect, it } from "vitest";
import { suggestionMeta, type KeywordSuggestion } from "./keyword-suggestions";

function keyword(phrase: string, overrides: Partial<KeywordSuggestion> = {}): KeywordSuggestion {
  return { phrase, matches: 0, lastUsedAt: null, active: true, ...overrides };
}

describe("suggestionMeta", () => {
  const now = Date.parse("2026-10-16T10:00:00.000Z");

  it("menyebut kata kunci yang belum pernah dijalankan", () => {
    expect(suggestionMeta(keyword("jasa baru"), now)).toBe("belum pernah dijalankan");
  });

  it("menyusun waktu pemakaian dan jumlah lead", () => {
    const item = keyword("jasa website", { lastUsedAt: "2026-10-16T08:00:00.000Z", matches: 12 });
    expect(suggestionMeta(item, now)).toBe("2 jam lalu · 12 lead");
  });

  it("menghitung selisih harian", () => {
    const item = keyword("jasa website", { lastUsedAt: "2026-10-13T10:00:00.000Z" });
    expect(suggestionMeta(item, now)).toBe("3 hari lalu");
  });

  it("menandai kata kunci yang dijeda", () => {
    const item = keyword("jasa lama", { lastUsedAt: "2026-10-16T09:59:30.000Z", active: false });
    expect(suggestionMeta(item, now)).toBe("baru saja · dijeda");
  });

  it("tidak menampilkan jumlah lead nol", () => {
    const item = keyword("jasa sepi", { lastUsedAt: "2026-10-16T09:30:00.000Z", matches: 0 });
    expect(suggestionMeta(item, now)).toBe("30 menit lalu");
  });
});
