import "server-only";
import { z } from "zod";
import { getThreadsConfig } from "./config";
import { ThreadsIntegrationError } from "./errors";
import { describeMetaError, metaErrorCode, parseMetaError } from "./meta-errors";
import type { ThreadsAdapter } from "./types";

const searchResponseSchema = z.object({
  data: z.array(z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    username: z.string().optional(),
    text: z.string().optional(),
    timestamp: z.string(),
    permalink: z.string().url().optional(),
    shortcode: z.string().optional(),
  })),
});
const publishResponseSchema = z.object({ id: z.union([z.string(), z.number()]).transform(String) });

/**
 * GET /{threads-user-id}/threads_publishing_limit
 * Mengembalikan pemakaian kuota publish + reply dalam 24 jam.
 */
const publishingLimitSchema = z.object({
  data: z.array(z.object({
    quota_usage: z.coerce.number().default(0),
    quota_limit: z.coerce.number().default(0),
    reply_quota_usage: z.coerce.number().default(0),
    reply_quota_limit: z.coerce.number().default(0),
  })),
});

async function requestMeta<T>(url: URL, schema: z.ZodType<T>, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const diagnostics = parseMetaError(payload, response.status);
    throw new ThreadsIntegrationError(
      metaErrorCode(diagnostics),
      response.status === 401 || response.status === 403
        ? "Koneksi Threads perlu diperbarui. Hubungkan kembali akun Anda."
        : "Threads sedang tidak dapat memproses permintaan. Silakan coba lagi nanti.",
      response.status >= 400 && response.status < 500 ? 400 : 502,
      describeMetaError(diagnostics),
    );
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ThreadsIntegrationError("META_RESPONSE_INVALID", "Threads sedang tidak dapat memproses permintaan. Silakan coba lagi nanti.", 502);
  return parsed.data;
}

export function createLiveThreadsAdapter(accessToken: string): ThreadsAdapter {
  const config = getThreadsConfig();
  return {
    async getCapability() { return "PUBLIC_SEARCH"; },
    async searchPosts(query) {
      const url = new URL(`${config.graphUrl}/keyword_search`);
      url.searchParams.set("q", query);
      url.searchParams.set("search_type", "RECENT");
      url.searchParams.set("limit", "25");
      url.searchParams.set("fields", "id,username,text,timestamp,permalink,shortcode");
      url.searchParams.set("access_token", accessToken);
      const result = await requestMeta(url, searchResponseSchema);
      return result.data.map(item => ({
        externalPostId: item.id,
        authorHandle: item.username ? `@${item.username}` : "@threads",
        authorName: item.username ?? "Pengguna Threads",
        body: item.text ?? "",
        permalink: item.permalink ?? `https://www.threads.net/@${item.username ?? "threads"}/post/${item.shortcode ?? item.id}`,
        postedAt: new Date(item.timestamp),
        capability: "PUBLIC_SEARCH" as const,
        simulated: false,
      }));
    },
    async publishReply(input) {
      const url = new URL(`${config.graphUrl}/me/threads`);
      url.searchParams.set("media_type", "TEXT");
      url.searchParams.set("text", input.body);
      url.searchParams.set("reply_to_id", input.postId);
      url.searchParams.set("auto_publish_text", "true");
      url.searchParams.set("access_token", accessToken);
      const result = await requestMeta(url, publishResponseSchema, { method: "POST", headers: { "Idempotency-Key": input.idempotencyKey } });
      return { status: "SENT", externalReplyId: result.id };
    },
    async getPublishingLimit() {
      const url = new URL(`${config.graphUrl}/me/threads_publishing_limit`);
      url.searchParams.set("access_token", accessToken);
      const result = await requestMeta(url, publishingLimitSchema);
      const item = result.data[0];
      return {
        quotaUsage: item?.quota_usage ?? 0,
        quotaLimit: item?.quota_limit ?? 0,
        replyQuotaUsage: item?.reply_quota_usage ?? 0,
        replyQuotaLimit: item?.reply_quota_limit ?? 0,
      };
    },
  };
}
