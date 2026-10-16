import { describe, expect, it, vi } from "vitest";
import { withCookieSearchFallback } from "./index";
import type { ThreadSearchResult, ThreadsAdapter } from "./types";

function hit(id: string, source: string): ThreadSearchResult {
  return {
    externalPostId: id,
    authorHandle: `@${source}`,
    authorName: source,
    body: `postingan dari ${source}`,
    permalink: `https://www.threads.com/@${source}/post/${id}`,
    postedAt: new Date("2026-10-16T00:00:00.000Z"),
    capability: "PUBLIC_SEARCH",
    simulated: false,
  };
}

function adapter(overrides: Partial<ThreadsAdapter> = {}): ThreadsAdapter {
  return {
    getCapability: vi.fn(async () => "PUBLIC_SEARCH" as const),
    searchPosts: vi.fn(async () => []),
    publishReply: vi.fn(async () => ({ status: "SENT" as const, externalReplyId: "1" })),
    getPublishingLimit: vi.fn(async () => ({ quotaUsage: 0, quotaLimit: 0, replyQuotaUsage: 0, replyQuotaLimit: 0 })),
    ...overrides,
  };
}

describe("withCookieSearchFallback", () => {
  it("memakai hasil resmi dan tidak menyentuh cookie bila resmi mengembalikan sesuatu", async () => {
    const live = adapter({ searchPosts: vi.fn(async () => [hit("1", "resmi")]) });
    const cookie = adapter();

    const results = await withCookieSearchFallback(live, cookie).searchPosts("jasa website");

    expect(results.map(item => item.authorName)).toEqual(["resmi"]);
    expect(cookie.searchPosts).not.toHaveBeenCalled();
  });

  it("beralih ke cookie saat pencarian resmi menjawab kosong", async () => {
    // Inilah keadaan pra-App-Review: Meta menjawab 200 dengan data kosong,
    // bukan error, sehingga tanpa cadangan pengguna melihat nol lead.
    const live = adapter({ searchPosts: vi.fn(async () => []) });
    const cookie = adapter({ searchPosts: vi.fn(async () => [hit("2", "cookie")]) });

    const results = await withCookieSearchFallback(live, cookie).searchPosts("jasa website");

    expect(results.map(item => item.authorName)).toEqual(["cookie"]);
    expect(cookie.searchPosts).toHaveBeenCalledWith("jasa website");
  });

  it("beralih ke cookie saat pencarian resmi melempar error", async () => {
    const live = adapter({ searchPosts: vi.fn(async () => { throw new Error("META_100"); }) });
    const cookie = adapter({ searchPosts: vi.fn(async () => [hit("3", "cookie")]) });

    const results = await withCookieSearchFallback(live, cookie).searchPosts("jasa website");

    expect(results.map(item => item.authorName)).toEqual(["cookie"]);
  });

  it("mengembalikan daftar kosong bila keduanya kosong, bukan melempar", async () => {
    const composite = withCookieSearchFallback(adapter(), adapter());
    await expect(composite.searchPosts("kata yang tidak ada")).resolves.toEqual([]);
  });

  it("meneruskan kegagalan cookie ke pemanggil", async () => {
    const cookie = adapter({ searchPosts: vi.fn(async () => { throw new Error("THREADS_WEB_SESSION_EXPIRED"); }) });
    const composite = withCookieSearchFallback(adapter(), cookie);
    await expect(composite.searchPosts("jasa website")).rejects.toThrow("THREADS_WEB_SESSION_EXPIRED");
  });

  it("tetap mengirim balasan lewat jalur resmi saja", async () => {
    const live = adapter();
    const cookie = adapter();

    await withCookieSearchFallback(live, cookie).publishReply({ postId: "1", body: "halo", idempotencyKey: "abc12345" });

    expect(live.publishReply).toHaveBeenCalled();
    expect(cookie.publishReply).not.toHaveBeenCalled();
  });

  it("melaporkan capability dan kuota dari jalur resmi", async () => {
    const live = adapter({ getPublishingLimit: vi.fn(async () => ({ quotaUsage: 3, quotaLimit: 250, replyQuotaUsage: 1, replyQuotaLimit: 1000 })) });
    const composite = withCookieSearchFallback(live, adapter());

    expect(await composite.getCapability()).toBe("PUBLIC_SEARCH");
    expect(await composite.getPublishingLimit()).toMatchObject({ quotaUsage: 3, quotaLimit: 250 });
  });
});
