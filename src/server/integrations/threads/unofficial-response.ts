import type { ThreadSearchResult } from "./types";

/**
 * Pembacaan hasil pencarian dari respons GraphQL internal Threads.
 *
 * Bentuk respons Barcelona berubah-ubah: edge pencarian kadang membungkus
 * `thread.thread_items[]`, kadang langsung `post`, dan jalur kuncinya ikut
 * berganti saat Meta memutakhirkan query. Karena itu kami menelusuri seluruh
 * payload dan mengenali sebuah post dari bentuknya sendiri, bukan dari jalur
 * yang pasti — satu perubahan nama field di sisi Meta tidak lagi membuat
 * pencarian mengembalikan nol hasil secara diam-diam.
 *
 * Murni: tidak menyentuh jaringan maupun database, jadi dapat diuji langsung.
 */

type RawPost = {
  pk?: unknown;
  code?: unknown;
  caption?: { text?: unknown } | null;
  taken_at?: unknown;
  like_count?: unknown;
  user?: { username?: unknown; full_name?: unknown } | null;
  text_post_app_info?: {
    direct_reply_count?: unknown;
    repost_count?: unknown;
    is_reply?: unknown;
    reply_to_author?: { username?: unknown } | null;
    self_thread_count?: unknown;
  } | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Hanya menerima angka yang benar-benar dikirim Threads; sisanya tetap tidak diketahui. */
function nonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : undefined;
}

function looksLikePost(value: Record<string, unknown>): boolean {
  if (!isObject(value.user)) return false;
  if (!isObject(value.caption) && !isObject(value.text_post_app_info)) return false;
  return Boolean(text((value.user as Record<string, unknown>).username));
}

function toSearchResult(raw: RawPost): ThreadSearchResult | null {
  const body = text(raw.caption?.text).trim();
  if (!body) return null;

  const externalPostId = typeof raw.pk === "string" || typeof raw.pk === "number" ? String(raw.pk) : "";
  if (!externalPostId) return null;

  const handle = text(raw.user?.username);
  const code = text(raw.code) || externalPostId;
  const takenAt = typeof raw.taken_at === "number" ? raw.taken_at : 0;

  return {
    externalPostId,
    authorHandle: handle ? `@${handle}` : "",
    authorName: text(raw.user?.full_name) || handle,
    body,
    permalink: handle ? `https://www.threads.com/@${handle}/post/${code}` : `https://www.threads.com/post/${code}`,
    postedAt: new Date(takenAt * 1000),
    capability: "PUBLIC_SEARCH",
    simulated: false,
    likeCount: nonNegative(raw.like_count),
    replyCount: nonNegative(raw.text_post_app_info?.direct_reply_count),
    repostCount: nonNegative(raw.text_post_app_info?.repost_count),
    isReply: raw.text_post_app_info?.is_reply === true,
    replyToHandle: text(raw.text_post_app_info?.reply_to_author?.username) || undefined,
    threadSize: nonNegative(raw.text_post_app_info?.self_thread_count),
  };
}

/** Mengumpulkan semua post unik di dalam payload, mengikuti urutan kemunculan. */
export function collectThreadPosts(payload: unknown): ThreadSearchResult[] {
  const results: ThreadSearchResult[] = [];
  const seen = new Set<string>();

  function walk(value: unknown, depth: number) {
    if (depth > 40 || !isObject(value)) return;

    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }

    if (looksLikePost(value)) {
      const result = toSearchResult(value as RawPost);
      if (result && !seen.has(result.externalPostId)) {
        seen.add(result.externalPostId);
        results.push(result);
      }
    }

    for (const key of Object.keys(value)) walk(value[key], depth + 1);
  }

  walk(payload, 0);
  return results;
}
