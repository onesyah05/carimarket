import { describe, expect, it } from "vitest";
import { collectThreadPosts } from "./unofficial-response";

function post(overrides: Record<string, unknown> = {}) {
  return {
    pk: "3100000000000000001",
    code: "DQabc123",
    caption: { text: "Lagi cari jasa pembuatan website, rekomendasi dong" },
    taken_at: 1_760_000_000,
    like_count: 12,
    user: { username: "nadia", full_name: "Nadia Pratama" },
    text_post_app_info: { direct_reply_count: 3, repost_count: 1 },
    ...overrides,
  };
}

describe("collectThreadPosts", () => {
  it("menemukan post betapa pun dalam sarangnya", () => {
    const payload = { data: { xdt_api__v1__text_feed__search_results__connection_v2: { edges: [{ node: { thread: { thread_items: [{ post: post() }] } } }] } } };
    const [result] = collectThreadPosts(payload);

    expect(result.externalPostId).toBe("3100000000000000001");
    expect(result.authorHandle).toBe("@nadia");
    expect(result.authorName).toBe("Nadia Pratama");
    expect(result.permalink).toBe("https://www.threads.com/@nadia/post/DQabc123");
    expect(result.postedAt.toISOString()).toBe(new Date(1_760_000_000_000).toISOString());
    expect(result.capability).toBe("PUBLIC_SEARCH");
    expect(result.simulated).toBe(false);
    expect(result).toMatchObject({ likeCount: 12, replyCount: 3, repostCount: 1 });
  });

  it("tetap menemukan post saat Meta mengganti nama jalurnya", () => {
    const payload = { data: { something_entirely_new: [{ wrapper: { post: post() } }] } };
    expect(collectThreadPosts(payload)).toHaveLength(1);
  });

  it("membuang duplikat berdasarkan id", () => {
    const payload = [{ post: post() }, { lain: { post: post({ code: "lain" }) } }];
    expect(collectThreadPosts(payload)).toHaveLength(1);
  });

  it("melewati post tanpa teks dan tanpa penulis", () => {
    const payload = [
      { post: post({ caption: { text: "   " } }) },
      { post: post({ pk: "2", user: { full_name: "Tanpa handle" } }) },
    ];
    expect(collectThreadPosts(payload)).toEqual([]);
  });

  it("membiarkan metrik tidak diketahui alih-alih menyebutnya nol", () => {
    const [result] = collectThreadPosts([{ post: post({ like_count: null, text_post_app_info: {} }) }]);
    expect(result.likeCount).toBeUndefined();
    expect(result.replyCount).toBeUndefined();
    expect(result.repostCount).toBeUndefined();
  });

  it("mengembalikan daftar kosong untuk payload error", () => {
    expect(collectThreadPosts({ errors: [{ message: "Sorry, something went wrong" }], data: null })).toEqual([]);
  });
});
