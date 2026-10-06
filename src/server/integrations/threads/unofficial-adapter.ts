import "server-only";
import { z } from "zod";
import { ThreadsIntegrationError } from "./errors";
import type { SearchCapability, ThreadSearchResult, ThreadsAdapter, ThreadsPublishingLimit } from "./types";
import {
  UNOFFICIAL_APP_ID,
  UNOFFICIAL_ASBD_ID,
  UNOFFICIAL_DOC_ID,
  UNOFFICIAL_ENDPOINT,
  UNOFFICIAL_OPERATION_NAME,
  UNOFFICIAL_ROOT_FIELD,
  type UnofficialCredentials,
} from "./unofficial-config";

/**
 * Adapter TIDAK RESMI untuk threads.com/graphql/query.
 *
 * Mengimplementasikan ThreadsAdapter sehingga search-service tidak perlu tahu
 * sumber datanya. Memakai cookie sesi web Threads, jadi pencarian berjalan
 * tanpa App Review Meta. Reply & publish TIDAK didukung di jalur ini —
 * setelah App Review disetujui, jalur resmi yang menangani publish.
 */

const userSchema = z.object({
  username: z.string().optional(),
  full_name: z.string().optional().nullable(),
});

const postSchema = z.object({
  pk: z.union([z.string(), z.number()]).transform(String),
  code: z.string().optional().nullable(),
  caption: z.object({ text: z.string().optional().nullable() }).optional().nullable(),
  taken_at: z.number().optional().nullable(),
  user: userSchema.optional().nullable(),
});

const threadSchema = z.object({
  thread_items: z.array(z.object({ post: postSchema.optional().nullable() })).optional().nullable(),
});

const edgeSchema = z.object({
  node: z.object({ thread: threadSchema.optional().nullable() }).optional().nullable(),
});

const searchResponseSchema = z.object({
  data: z
    .object({
      searchResults: z
        .object({
          edges: z.array(edgeSchema).default([]),
        })
        .optional()
        .nullable(),
    })
    .optional()
    .nullable(),
});

function buildVariables(query: string) {
  return {
    after: null,
    before: null,
    first: 10,
    last: null,
    query,
    recent: 1,
    search_surface: "default",
    tagID: null,
    trend_fbid: null,
    meta_place_id: null,
    pinned_ids: null,
    power_search_info: null,
    has_communities: true,
    has_community_green_dot: false,
    has_favicons: false,
    has_live_chats: false,
    has_serp_header: false,
    // Provider flags wajib; tanpa ini server GraphQL menolak eksekusi.
    __relay_internal__pv__BarcelonaHasSERPHeaderrelayprovider: false,
    __relay_internal__pv__BarcelonaHasCommunitiesOrLoggedOutrelayprovider: true,
    __relay_internal__pv__BarcelonaHasWebFaviconsrelayprovider: false,
    __relay_internal__pv__BarcelonaHasCommunityGreenDotrelayprovider: false,
    __relay_internal__pv__BarcelonaMessagesHasLiveChatMessagingrelayprovider: false,
    __relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider: false,
    __relay_internal__pv__BarcelonaHasCommunityBobbleheadsrelayprovider: true,
    __relay_internal__pv__BarcelonaHasCommunityTrendingBadgingrelayprovider: false,
    __relay_internal__pv__BarcelonaIsLoggedInrelayprovider: true,
    __relay_internal__pv__BarcelonaShouldFetchPostAuthorFullNamerelayprovider: true,
    __relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider: true,
    __relay_internal__pv__BarcelonaHasMetaAiContentAttachmentsrelayprovider: false,
    __relay_internal__pv__BarcelonaHasEventBadgerelayprovider: false,
    __relay_internal__pv__BarcelonaHasBestOfThreadsrelayprovider: false,
    __relay_internal__pv__BarcelonaMessagingHasMetaAIBotrelayprovider: false,
    __relay_internal__pv__BarcelonaGenAIRepliesEnabledrelayprovider: true,
    __relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider: false,
    __relay_internal__pv__BarcelonaHasCommunitiesrelayprovider: true,
    __relay_internal__pv__BarcelonaHasGameScoreSharerelayprovider: true,
    __relay_internal__pv__BarcelonaHasPublicViewCountCardrelayprovider: true,
    __relay_internal__pv__BarcelonaHasCommunityEmojiUpdateCardrelayprovider: true,
    __relay_internal__pv__BarcelonaHasCommunityEntityCardrelayprovider: true,
    __relay_internal__pv__BarcelonaHasScorecardCommunityrelayprovider: true,
    __relay_internal__pv__BarcelonaHasSportTeamAllegianceCardrelayprovider: true,
    __relay_internal__pv__BarcelonaHasMusicrelayprovider: true,
    __relay_internal__pv__BarcelonaHasNewspaperLinkStylerelayprovider: false,
    __relay_internal__pv__BarcelonaHasMessagingrelayprovider: true,
    __relay_internal__pv__BarcelonaHasPodcastV2Consumptionrelayprovider: true,
    __relay_internal__pv__BarcelonaHasPodcastTranscriptConsumptionrelayprovider: true,
    __relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider: true,
    __relay_internal__pv__BarcelonaShouldFulfillLightboxQueryrelayprovider: true,
    __relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider: false,
    __relay_internal__pv__BarcelonaIsCrawlerrelayprovider: false,
    __relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider: false,
    __relay_internal__pv__BarcelonaHasViewerRepliedrelayprovider: true,
    __relay_internal__pv__BarcelonaHasPrivateRepliesDeprecationrelayprovider: false,
    __relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider: false,
    __relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider: true,
    __relay_internal__pv__BarcelonaIsInternalUserrelayprovider: false,
  };
}

async function requestUnofficial<T>(
  credentials: UnofficialCredentials,
  body: URLSearchParams,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(UNOFFICIAL_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "*/*",
      "content-type": "application/x-www-form-urlencoded",
      cookie: credentials.cookie,
      origin: "https://www.threads.com",
      referer: "https://www.threads.com/search",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
      "x-asbd-id": UNOFFICIAL_ASBD_ID,
      "x-csrftoken": credentials.csrf,
      "x-fb-friendly-name": UNOFFICIAL_OPERATION_NAME,
      "x-fb-lsd": credentials.lsd,
      "x-ig-app-id": UNOFFICIAL_APP_ID,
      "x-root-field-name": UNOFFICIAL_ROOT_FIELD,
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const payload = (await response.json().catch(() => null)) as { errors?: Array<{ message?: string }>; data?: unknown } | null;

  if (!response.ok || (payload?.errors && payload.errors.length > 0)) {
    const message = payload?.errors?.[0]?.message ?? "Threads sedang tidak dapat memproses permintaan.";
    // 401/403 → cookie kedaluwarsa; admin harus update.
    const expired = response.status === 401 || response.status === 403 || /login|session|authen/i.test(message);
    throw new ThreadsIntegrationError(
      expired ? "THREADS_WEB_SESSION_EXPIRED" : `THREADS_WEB_${response.status}`,
      expired
        ? "Sesi Threads kedaluwarsa. Admin perlu memperbarui kredensial di panel superadmin."
        : "Threads sedang tidak dapat memproses permintaan. Silakan coba lagi nanti.",
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ThreadsIntegrationError(
      "THREADS_WEB_RESPONSE_INVALID",
      "Threads sedang tidak dapat memproses permintaan. Silakan coba lagi nanti.",
      502,
    );
  }
  return parsed.data;
}

export function createUnofficialThreadsAdapter(credentials: UnofficialCredentials): ThreadsAdapter {
  return {
    async getCapability(): Promise<SearchCapability> {
      return "PUBLIC_SEARCH";
    },

    async searchPosts(query: string): Promise<ThreadSearchResult[]> {
      const body = new URLSearchParams();
      body.append("lsd", credentials.lsd);
      body.append("variables", JSON.stringify(buildVariables(query)));
      body.append("doc_id", UNOFFICIAL_DOC_ID);
      body.append("fb_api_caller_class", "RelayModern");
      body.append("fb_api_req_friendly_name", UNOFFICIAL_OPERATION_NAME);
      body.append("server_timestamps", "true");

      const payload = await requestUnofficial(credentials, body, searchResponseSchema);
      const edges = payload.data?.searchResults?.edges ?? [];

      const results: ThreadSearchResult[] = [];
      for (const edge of edges) {
        const post = edge.node?.thread?.thread_items?.[0]?.post;
        if (!post) continue;
        const text = post.caption?.text?.trim() ?? "";
        if (!text) continue;

        const code = post.code ?? post.pk;
        const handle = post.user?.username ?? "";
        results.push({
          externalPostId: post.pk,
          authorHandle: handle ? `@${handle}` : "",
          authorName: post.user?.full_name ?? handle ?? "",
          body: text,
          permalink: handle ? `https://www.threads.com/@${handle}/post/${code}` : `https://www.threads.com/post/${code}`,
          postedAt: new Date((post.taken_at ?? 0) * 1000),
          capability: "PUBLIC_SEARCH",
          simulated: false,
        });
      }
      return results;
    },

    async publishReply(): Promise<{ status: "SENT" | "SIMULATED_SENT"; externalReplyId?: string }> {
      // Jalur tidak resmi sengaja tidak mengirim balasan: tidak ada endpoint
      // publish yang aman tanpa API resmi, dan kami tidak meniru request
      // tulis yang bisa membahayakan akun milik admin.
      throw new ThreadsIntegrationError(
        "UNOFFICIAL_PUBLISH_UNSUPPORTED",
        "Mengirim balasan butuh API resmi Meta. Setelah App Review disetujui, aktifkan integrasi resmi.",
        405,
      );
    },

    async getPublishingLimit(): Promise<ThreadsPublishingLimit> {
      // Kuota hanya tersedia lewat API resmi. Laporkan 0/0 agar UI tidak
      // menampilkan angka yang menyesatkan saat memakai jalur tidak resmi.
      return { quotaUsage: 0, quotaLimit: 0, replyQuotaUsage: 0, replyQuotaLimit: 0 };
    },
  };
}
