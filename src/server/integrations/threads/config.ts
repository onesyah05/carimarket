import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { loadUnofficialCredentials } from "./unofficial-credentials";
import { ThreadsIntegrationError } from "./errors";

const DEFAULT_GRAPH_URL = "https://graph.threads.net/v1.0";

const envSchema = z.object({
  THREADS_APP_ID: z.string().min(1),
  THREADS_APP_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  THREADS_GRAPH_URL: z.string().url().default(DEFAULT_GRAPH_URL),
  APP_ENCRYPTION_KEY: z.string().refine(value => {
    const key = /^[a-f\d]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
    return key.length === 32;
  }),
});

export const THREADS_SCOPES = ["threads_basic", "threads_keyword_search", "threads_content_publish"] as const;

let appCredentialCache: { fingerprint: string; checkedAt: number; status: "valid" | "invalid" | "unavailable" } | null = null;

/**
 * Meta Graph API memerlukan prefix versi (mis. /v1.0/). Tanpa prefix, Graph
 * akan memakai versi tertua yang masih tersedia, yang tidak stabil saat Meta
 * merilis versi baru. Fungsi ini memastikan selalu ada /vN.N/ di akhir base URL.
 */
function normalizeGraphUrl(rawUrl: string) {
  const withoutSlash = rawUrl.replace(/\/+$/, "");
  return /\/v\d+\.\d+$/.test(withoutSlash) ? withoutSlash : `${withoutSlash}/v1.0`;
}

export function getThreadsConfig() {
  const parsed = envSchema.safeParse({
    THREADS_APP_ID: process.env.THREADS_APP_ID,
    THREADS_APP_SECRET: process.env.THREADS_APP_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    THREADS_GRAPH_URL: process.env.THREADS_GRAPH_URL ?? DEFAULT_GRAPH_URL,
    APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
  });

  if (!parsed.success) {
    throw new ThreadsIntegrationError("THREADS_NOT_CONFIGURED", "Koneksi Threads belum tersedia. Silakan hubungi administrator.", 503);
  }

  const appUrl = new URL(parsed.data.NEXT_PUBLIC_APP_URL);
  return {
    appId: parsed.data.THREADS_APP_ID,
    appSecret: parsed.data.THREADS_APP_SECRET,
    appUrl,
    graphUrl: normalizeGraphUrl(parsed.data.THREADS_GRAPH_URL),
    redirectUri: new URL("/api/integrations/threads/callback", appUrl).toString(),
  };
}

/** Memeriksa pasangan Threads App ID/Secret tanpa menyimpan atau mencatat token aplikasi. */
export async function getThreadsAppCredentialStatus(): Promise<"valid" | "invalid" | "unavailable"> {
  const config = getThreadsConfig();
  const fingerprint = createHash("sha256").update(config.appId).update("\0").update(config.appSecret).digest("hex");
  if (appCredentialCache?.fingerprint === fingerprint && Date.now() - appCredentialCache.checkedAt < 5 * 60_000) {
    return appCredentialCache.status;
  }

  let status: "valid" | "invalid" | "unavailable" = "unavailable";
  try {
    const response = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.appId,
        client_secret: config.appSecret,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const payload = await response.json().catch(() => null) as { access_token?: string; error?: { code?: number } } | null;
    if (response.ok && payload?.access_token) status = "valid";
    else if (payload?.error?.code === 101) status = "invalid";
  } catch {
    status = "unavailable";
  }

  appCredentialCache = { fingerprint, checkedAt: Date.now(), status };
  return status;
}

export async function getThreadsOAuthReadiness(): Promise<"valid" | "invalid" | "unavailable" | "not_configured"> {
  try {
    return await getThreadsAppCredentialStatus();
  } catch {
    return "not_configured";
  }
}

export function isThreadsConfigured() {
  if (process.env.INTEGRATION_MODE === "local") return true;
  try {
    getThreadsConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Benar-benar ada sumber Threads yang bisa dipakai saat ini:
 * - integrasi resmi sudah dikonfigurasi, atau
 * - Superadmin sudah mengisi kredensial tidak resmi (pre-App-Review).
 *
 * Fungsi ini async karena mengecek database; pakai ini di route yang perlu
 * tahu apakah pencarian bisa jalan. `isThreadsConfigured` (sync) tetap
 * tersedia untuk cek cepat konfigurasi resmi saja.
 */
export async function isThreadsAvailable(): Promise<boolean> {
  if (isThreadsConfigured()) return true;
  return (await loadUnofficialCredentials()) !== null;
}
