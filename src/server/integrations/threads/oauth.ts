import "server-only";
import { z } from "zod";
import { getThreadsConfig, THREADS_SCOPES } from "./config";
import { ThreadsIntegrationError } from "./errors";

const shortTokenSchema = z.object({ access_token: z.string().min(1), user_id: z.union([z.string(), z.number()]).transform(String) });
const longTokenSchema = z.object({ access_token: z.string().min(1), token_type: z.string().optional(), expires_in: z.number().int().positive() });
const profileSchema = z.object({ id: z.union([z.string(), z.number()]).transform(String), username: z.string().min(1), name: z.string().optional() });

async function metaRequest<T>(url: URL, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: number } } | null;
  if (!response.ok) {
    throw new ThreadsIntegrationError(
      `META_${payload?.error?.code ?? response.status}`,
      "Akun Threads belum berhasil dihubungkan. Silakan coba lagi.",
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ThreadsIntegrationError("META_RESPONSE_INVALID", "Akun Threads belum berhasil dihubungkan. Silakan coba lagi.", 502);
  return parsed.data;
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
  return metaRequest(url, longTokenSchema);
}

export async function refreshLongLivedToken(token: string) {
  const config = getThreadsConfig();
  const url = new URL(`${config.graphUrl}/refresh_access_token`);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", token);
  return metaRequest(url, longTokenSchema);
}

export async function getThreadsProfile(token: string) {
  const config = getThreadsConfig();
  const url = new URL(`${config.graphUrl}/me`);
  url.searchParams.set("fields", "id,username,name");
  url.searchParams.set("access_token", token);
  return metaRequest(url, profileSchema);
}
