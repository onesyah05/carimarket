import "server-only";

/**
 * Konfigurasi untuk endpoint TIDAK RESMI threads.com/graphql/query.
 *
 * Endpoint ini adalah GraphQL internal yang dipakai web app Threads sendiri
 * (Relay/Barcelona). Tidak memerlukan App Review Meta, jadi pencarian sudah
 * jalan sebelum persetujuan resmi selesai. Kebalikannya: butuh cookie sesi
 * web (sessionid/csrftoken/lsd) yang harus diisi Superadmin, dan bisa kedaluwarsa.
 *
 * Setelah App Review disetujui, integrasi resmi (live-adapter.ts) menjadi
 * sumber utama dan konfigurasi ini cukup dibiarkan tidak terisi.
 */

export const UNOFFICIAL_ENDPOINT = "https://www.threads.com/graphql/query";
export const UNOFFICIAL_DOC_ID = "28791380750457830";
export const UNOFFICIAL_OPERATION_NAME = "BarcelonaSearchResultsRefetchableQuery";
export const UNOFFICIAL_ROOT_FIELD = "xdt_api__v1__text_feed__search_results__connection_v2";

/** App-ID web Threads (publik, terlihat di setiap request web app). */
export const UNOFFICIAL_APP_ID = "238260118697367";
export const UNOFFICIAL_ASBD_ID = "359341";

/** Key PlatformSecret untuk cookie sesi lengkap (format "k=v; k=v"). */
export const SECRET_THREADS_WEB_COOKIE = "threads_web_cookie";
/** Key PlatformSecret untuk token lsd (x-fb-lsd). */
export const SECRET_THREADS_WEB_LSD = "threads_web_lsd";
/** Key PlatformSecret untuk csrftoken (x-csrftoken). */
export const SECRET_THREADS_WEB_CSRF = "threads_web_csrf";

export type UnofficialCredentials = {
  /** Cookie string lengkap, mis. "sessionid=...; csrftoken=...; ds_user_id=..." */
  cookie: string;
  /** Token lsd dari halaman Threads. */
  lsd: string;
  /** Token csrf (nilai cookie csrftoken). */
  csrf: string;
};

const COOKIE_KEYS = ["sessionid", "csrftoken", "ds_user_id"] as const;

/**
 * Mengembalikan kredensial tidak resmi jika sudah diisi Superadmin.
 * Mengembalikan null bila belum ada — pemanggil wajib menangani fallback.
 */
export function parseUnofficialCredentials(cookie: string, lsd: string, csrf: string): UnofficialCredentials | null {
  const normalized = cookie.trim();
  if (!normalized || !lsd.trim() || !csrf.trim()) return null;

  const lower = normalized.toLowerCase();
  const hasAll = COOKIE_KEYS.every(key => lower.includes(`${key}=`));
  if (!hasAll) return null;

  return { cookie: normalized, lsd: lsd.trim(), csrf: csrf.trim() };
}
