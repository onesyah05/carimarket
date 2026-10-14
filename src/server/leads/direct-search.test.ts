import { describe, expect, it } from "vitest";
import { directSearchSchema, toDirectHits } from "./direct-search";
import type { ThreadSearchResult } from "@/server/integrations/threads/types";

function result(overrides: Partial<ThreadSearchResult> = {}): ThreadSearchResult {
  return {
    externalPostId: "1",
    authorHandle: "@nadia",
    authorName: "Nadia Pratama",
    body: "Lagi cari jasa pembuatan website",
    permalink: "https://www.threads.com/@nadia/post/DQabc",
    postedAt: new Date("2026-10-14T03:00:00.000Z"),
    capability: "PUBLIC_SEARCH",
    simulated: false,
    ...overrides,
  };
}

describe("directSearchSchema", () => {
  it("merapikan spasi di sekitar kata kunci", () => {
    const parsed = directSearchSchema.safeParse({ query: "  jasa website  " });
    expect(parsed.success && parsed.data.query).toBe("jasa website");
  });

  it("menolak kata kunci satu huruf", () => {
    const parsed = directSearchSchema.safeParse({ query: "a" });
    expect(parsed.success).toBe(false);
    expect(parsed.success || parsed.error.issues[0]?.message).toBe("Kata kunci minimal 2 karakter.");
  });

  it("menolak kata kunci di atas 100 karakter", () => {
    expect(directSearchSchema.safeParse({ query: "a".repeat(101) }).success).toBe(false);
  });
});

describe("toDirectHits", () => {
  it("mengurutkan dari yang terbaru", () => {
    const hits = toDirectHits([
      result({ externalPostId: "lama", postedAt: new Date("2026-10-10T00:00:00.000Z") }),
      result({ externalPostId: "baru", postedAt: new Date("2026-10-14T00:00:00.000Z") }),
      result({ externalPostId: "tengah", postedAt: new Date("2026-10-12T00:00:00.000Z") }),
    ]);
    expect(hits.map(hit => hit.externalPostId)).toEqual(["baru", "tengah", "lama"]);
  });

  it("membuang postingan tanpa teks", () => {
    expect(toDirectHits([result({ body: "   " })])).toEqual([]);
  });

  it("membiarkan metrik yang tidak dikirim sebagai null, bukan nol", () => {
    const [hit] = toDirectHits([result()]);
    expect(hit).toMatchObject({ likeCount: null, replyCount: null, repostCount: null });
  });

  it("meneruskan metrik nol apa adanya", () => {
    const [hit] = toDirectHits([result({ likeCount: 0, replyCount: 4 })]);
    expect(hit).toMatchObject({ likeCount: 0, replyCount: 4, repostCount: null });
  });

  it("memakai handle sebagai nama ketika nama kosong", () => {
    const [hit] = toDirectHits([result({ authorName: "" })]);
    expect(hit.authorName).toBe("@nadia");
  });
});
