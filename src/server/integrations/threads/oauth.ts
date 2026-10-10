import "server-only";
import { z } from "zod";
import { getThreadsConfig, THREADS_SCOPES } from "./config";
import { ThreadsIntegrationError } from "./errors";
import { describeMetaError, isTransientMetaFailure, metaErrorCode, parseMetaError } from "./meta-errors";

/** Token jangka pendek Threads berlaku 1 jam bila Meta tidak menyebutkan durasinya. */
export const SHORT_LIVED_TOKEN_TTL_SECONDS = 3600;

const shortTokenSchema = z.object({
  access_token: z.string().min(1),
  user_id: z.union([z.string(), z.number()]).transform(String),
  expires_in: z.number().int().positive().optional(),
});
const longTokenSchema = z.object({ access_token: z.string().min(1), token_type: z.string().optional(), expires_in: z.number().int().positive() });
const profileSchema = z.object({ id: z.union([z.string(), z.number()]).transform(String), username: z.string().min(1), name: z.string().optional() });

type RequestOptions = {
  /** Jumlah percobaan tambahan untuk kegagalan sementara di sisi Meta. */
  retries?: number;
  /** Pesan yang dilihat pengguna bila permintaan gagal. */
  userMessage?: string;
};

const RETRY_DELAYS_MS = [400, 1200];

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function metaRequest<T>(url: URL, schema: z.ZodType<T>, init?: RequestInit, options?: RequestOptions): Promise<T> {
  const userMessage = options?.userMessage ?? "Akun Threads belum berhasil dihubungkan. Silakan coba lagi.";
  const attempts = Math.min(options?.retries ?? 0, RETRY_DELAYS_MS.length) + 1;
  let lastError: ThreadsIntegrationError | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const diagnostics = parseMetaError(payload, response.status);
      lastError = new ThreadsIntegrationError(
        metaErrorCode(diagnostics),
        userMessage,
        response.status >= 400 && response.status < 500 ? 400 : 502,
        describeMetaError(diagnostics),
      );
      // Kegagalan sementara Meta layak dicoba ulang; error parameter tidak.
      if (attempt + 1 < attempts && isTransientMetaFailure(diagnostics)) {
        await delay(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw lastError;
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ThreadsIntegrationError(
        "META_RESPONSE_INVALID",
        userMessage,
        502,
        `http=${response.status} bentuk respons Meta tidak sesuai harapan`,
      );
    }
    return parsed.data;
  }

  throw lastError ?? new ThreadsIntegrationError("META_REQUEST_FAILED", userMessage, 502);
}

export function buildThreadsAuthorizationUrl(state: string) {
  const config = getThreadsConfig();
  const url = new URL("https://threads.net/oauth/authorize");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", THREADS_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url;
}

/** Kode otorisasi hanya sekali pakai, jadi langkah ini tidak pernah diulang otomatis. */
export async function exchangeAuthorizationCode(code: string) {
  const config = getThreadsConfig();
  const url = new URL(`${config.graphUrl}/oauth/access_token`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("code", code);
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  return metaRequest(url, shortTokenSchema, { method: "POST" });
}

export async function exchangeLongLivedToken(shortLivedToken: string) {
  const config = getThreadsConfig();
  const url = new URL(`${config.graphUrl}/access_token`);
  url.searchParams.set("grant_type", "th_exchange_token");
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("access_token", shortLivedToken);
  return metaRequest(url, longTokenSchema, undefined, { retries: 2 });
}

export async function refreshLongLivedToken(token: string) {
  const config = getThreadsConfig();
  const url = new URL(`${config.graphUrl}/refresh_access_token`);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", token);
  return metaRequest(url, longTokenSchema, undefined, {
    retries: 2,
    userMessage: "Koneksi Threads perlu diperbarui. Hubungkan kembali akun Anda.",
  });
}

export async function getThreadsProfile(token: string) {
  const config = getThreadsConfig();
  const url = new URL(`${config.graphUrl}/me`);
  url.searchParams.set("fields", "id,username,name");
  url.searchParams.set("access_token", token);
  return metaRequest(url, profileSchema, undefined, { retries: 1 });
}
