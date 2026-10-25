import { describe, expect, it } from "vitest";
import { buildDigestHtml, type DigestLead } from "./digest";
import { MATCH_THRESHOLD } from "./ai-matching";

/**
 * Isi email berasal dari postingan orang lain, jadi yang diuji di sini
 * terutama apa yang TIDAK boleh ikut terkirim.
 */

function lead(overrides: Partial<DigestLead> = {}): DigestLead {
  return {
    score: 92,
    aiReason: "Butuh jasa desain logo",
    matchReason: null,
    threadPost: {
      authorHandle: "contoh.rian",
      authorName: "Rian",
      body: "Ada rekomendasi jasa desain logo?",
      permalink: "https://www.threads.net/@contoh.rian/post/abc",
    },
    keywordMatches: [{ keyword: { phrase: "jasa desain logo" } }],
    ...overrides,
  };
}

describe("buildDigestHtml", () => {
  it("meng-escape HTML dari isi postingan", () => {
    const html = buildDigestHtml(1, [lead({
      threadPost: {
        authorHandle: "penyerang",
        authorName: null,
        body: '<script>alert("xss")</script> butuh logo',
        permalink: null,
      },
    })], 0);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("tidak pernah memasang tautan selain http dan https", () => {
    const html = buildDigestHtml(1, [lead({
      threadPost: { authorHandle: "a", authorName: null, body: "isi", permalink: "javascript:alert(1)" },
    })], 0);

    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("Buka postingan");
  });

  it("memasang tautan ketika permalink benar-benar https", () => {
    expect(buildDigestHtml(1, [lead()], 0)).toContain("Buka postingan");
  });

  it("menyebut skor dan kata kunci tiap lead", () => {
    const html = buildDigestHtml(1, [lead({ score: 87 })], 0);
    expect(html).toContain("Skor 87");
    expect(html).toContain("jasa desain logo");
  });

  it("menyebut ambang yang dipakai, bukan angka yang dikarang", () => {
    expect(buildDigestHtml(1, [lead()], 0)).toContain(`${MATCH_THRESHOLD} ke atas`);
  });

  it("menyebutkan sisa lead hanya bila memang ada", () => {
    expect(buildDigestHtml(25, [lead()], 24)).toContain("24 lead lainnya");
    expect(buildDigestHtml(1, [lead()], 0)).not.toContain("lead lainnya");
  });

  it("tidak memakai em dash, sesuai Content Voice di DESIGN.md", () => {
    expect(buildDigestHtml(2, [lead(), lead()], 3)).not.toContain("—");
  });

  it("memakai tabel, karena Outlook merender dengan mesin Word", () => {
    expect(buildDigestHtml(1, [lead()], 0)).toContain("<table");
    expect(buildDigestHtml(1, [lead()], 0)).not.toContain("display:flex");
  });
});
