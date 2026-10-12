import "server-only";
import { ThreadsIntegrationError } from "./errors";
import type { SearchCapability, ThreadSearchResult, ThreadsAdapter, ThreadsPublishingLimit } from "./types";
import { collectThreadPosts } from "./unofficial-response";
import {
  UNOFFICIAL_APP_ID,
  UNOFFICIAL_ASBD_ID,
  UNOFFICIAL_BLOKS_VERSION,
  UNOFFICIAL_BOOTSTRAP_URL,
  UNOFFICIAL_DOC_ID,
  UNOFFICIAL_ENDPOINT,
  UNOFFICIAL_OPERATION_NAME,
  UNOFFICIAL_RELAY_PROVIDERS,
  UNOFFICIAL_ROOT_FIELD,
  UNOFFICIAL_USER_AGENT,
  extractSessionTokens,
  type UnofficialCredentials,
  type UnofficialSessionTokens,
} from "./unofficial-config";

/**
 * Adapter TIDAK RESMI untuk threads.com/api/graphql.
 *
 * Mengimplementasikan ThreadsAdapter sehingga search-service tidak perlu tahu
 * sumber datanya. Memakai cookie sesi web Threads, jadi pencarian berjalan
 * tanpa App Review Meta. Reply & publish TIDAK didukung di jalur ini —
 * setelah App Review disetujui, jalur resmi yang menangani publish.
 *
 * Satu-satunya kredensial yang disimpan adalah cookie. Token `fb_dtsg` dan
 * `lsd` berganti tiap beberapa jam, jadi adapter mengambilnya sendiri dari
 * halaman depan Threads dan menyimpannya sebentar di memori.
 */

const TOKEN_TTL_MS = 10 * 60 * 1000;

/**
 * Cache satu entri saja: hanya ada satu kredensial platform, dan menahan lebih
 * banyak hanya memperpanjang umur token sesi di memori tanpa manfaat.
 */
let tokenCache: { cookie: string; tokens: UnofficialSessionTokens; expiresAt: number } | null = null;

function sessionExpired(diagnostics: string) {
  return new ThreadsIntegrationError(
    "THREADS_WEB_SESSION_EXPIRED",
    "Sesi Threads kedaluwarsa. Admin perlu memperbarui cookie di panel superadmin.",
    400,
    diagnostics,
  );
}

/** Membuang token sesi yang tersimpan, mis. setelah Threads menolak request. */
export function resetUnofficialSessionCache() {
  tokenCache = null;
}

async function loadSessionTokens(credentials: UnofficialCredentials): Promise<UnofficialSessionTokens> {
  if (tokenCache && tokenCache.cookie === credentials.cookie && tokenCache.expiresAt > Date.now()) {
    return tokenCache.tokens;
  }

  let response: Response;
  try {
    response = await fetch(UNOFFICIAL_BOOTSTRAP_URL, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        cookie: credentials.cookie,
        "user-agent": UNOFFICIAL_USER_AGENT,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ThreadsIntegrationError(
      "THREADS_WEB_UNREACHABLE",
      "Threads sedang tidak dapat dihubungi. Silakan coba lagi nanti.",
      502,
      "bootstrap fetch failed",
    );
  }

  if (!response.ok) {
    throw sessionExpired(`bootstrap HTTP ${response.status}`);
  }

  const tokens = extractSessionTokens(await response.text());
  if (!tokens) {
    throw sessionExpired("token fb_dtsg/lsd tidak ditemukan di halaman");
  }

  tokenCache = { cookie: credentials.cookie, tokens, expiresAt: Date.now() + TOKEN_TTL_MS };
  return tokens;
}

function buildVariables(query: string) {
  return {
    query,
    // Harus integer 1/0, bukan boolean: server menolak nilai bertipe lain.
    recent: 1,
    search_surface: "default",
    after: null,
    before: null,
    meta_place_id: null,
    pinned_ids: null,
    power_search_info: null,
    tagID: null,
    trend_fbid: null,
    ...UNOFFICIAL_RELAY_PROVIDERS,
  };
}

async function runSearch(
  credentials: UnofficialCredentials,
  tokens: UnofficialSessionTokens,
  query: string,
): Promise<unknown> {
  const body = new URLSearchParams({
    __a: "1",
    __comet_req: "29",
    __req: "1",
    __user: "0",
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: UNOFFICIAL_OPERATION_NAME,
    fb_dtsg: tokens.fbDtsg,
    jazoest: tokens.jazoest,
    lsd: tokens.lsd,
    server_timestamps: "true",
    variables: JSON.stringify(buildVariables(query)),
    doc_id: UNOFFICIAL_DOC_ID,
  });

  let response: Response;
  try {
    response = await fetch(UNOFFICIAL_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "content-type": "application/x-www-form-urlencoded",
        cookie: credentials.cookie,
        origin: "https://www.threads.com",
        referer: `https://www.threads.com/search?q=${encodeURIComponent(query)}&serp_type=default&filter=recent`,
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": UNOFFICIAL_USER_AGENT,
        "x-asbd-id": UNOFFICIAL_ASBD_ID,
        "x-bloks-version-id": UNOFFICIAL_BLOKS_VERSION,
        "x-csrftoken": credentials.csrf,
        "x-fb-friendly-name": UNOFFICIAL_OPERATION_NAME,
        "x-fb-lsd": tokens.lsd,
        "x-ig-app-id": UNOFFICIAL_APP_ID,
        "x-root-field-name": UNOFFICIAL_ROOT_FIELD,
      },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ThreadsIntegrationError(
      "THREADS_WEB_UNREACHABLE",
      "Threads sedang tidak dapat dihubungi. Silakan coba lagi nanti.",
      502,
      "graphql fetch failed",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { errors?: Array<{ message?: string }>; data?: unknown }
    | null;

  if (!response.ok) {
    // 401/403 → cookie kedaluwarsa; admin harus memperbarui.
    if (response.status === 401 || response.status === 403) {
      resetUnofficialSessionCache();
      throw sessionExpired(`graphql HTTP ${response.status}`);
    }
    throw new ThreadsIntegrationError(
      `THREADS_WEB_${response.status}`,
      "Threads sedang tidak dapat memproses permintaan. Silakan coba lagi nanti.",
      response.status >= 400 && response.status < 500 ? 400 : 502,
      `graphql HTTP ${response.status}`,
    );
  }

  const firstError = payload?.errors?.[0]?.message;
  // Payload parsial masih berisi hasil; hanya error sesi yang benar-benar fatal.
  if (firstError && /login|session|authen|not authorized/i.test(firstError)) {
    resetUnofficialSessionCache();
    throw sessionExpired("graphql menolak sesi");
  }

  if (!payload) {
    throw new ThreadsIntegrationError(
      "THREADS_WEB_RESPONSE_INVALID",
      "Threads sedang tidak dapat memproses permintaan. Silakan coba lagi nanti.",
      502,
      "respons bukan JSON",
    );
  }

  return payload;
}

export function createUnofficialThreadsAdapter(credentials: UnofficialCredentials): ThreadsAdapter {
  return {
    async getCapability(): Promise<SearchCapability> {
      return "PUBLIC_SEARCH";
    },

    async searchPosts(query: string): Promise<ThreadSearchResult[]> {
      const tokens = await loadSessionTokens(credentials);
      let payload: unknown;
      try {
        payload = await runSearch(credentials, tokens, query);
      } catch (error) {
        // Token bisa kedaluwarsa di tengah TTL cache; coba sekali lagi dengan
        // token segar sebelum menyimpulkan cookie-nya yang sudah mati.
        if (!(error instanceof ThreadsIntegrationError) || error.code !== "THREADS_WEB_SESSION_EXPIRED") throw error;
        resetUnofficialSessionCache();
        payload = await runSearch(credentials, await loadSessionTokens(credentials), query);
      }
      return collectThreadPosts(payload);
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
