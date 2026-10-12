import "server-only";

/**
 * Konfigurasi untuk endpoint TIDAK RESMI threads.com/api/graphql.
 *
 * Endpoint ini adalah GraphQL internal yang dipakai web app Threads sendiri
 * (Relay/Barcelona). Tidak memerlukan App Review Meta, jadi pencarian sudah
 * jalan sebelum persetujuan resmi selesai. Kebalikannya: butuh cookie sesi web
 * Threads yang harus diisi Superadmin, dan bisa kedaluwarsa.
 *
 * Yang disimpan hanya cookie. Token `csrftoken` dibaca dari cookie itu sendiri,
 * sedangkan `fb_dtsg` dan `lsd` berumur pendek sehingga diambil ulang dari
 * halaman depan Threads setiap kali dibutuhkan — memintanya ke operator hanya
 * membuat kredensial basi dalam hitungan jam.
 *
 * Setelah App Review disetujui, integrasi resmi (live-adapter.ts) menjadi
 * sumber utama dan konfigurasi ini cukup dibiarkan tidak terisi.
 */

export const UNOFFICIAL_ENDPOINT = "https://www.threads.com/api/graphql";
/** Halaman yang dibaca untuk mengambil token sesi berumur pendek. */
export const UNOFFICIAL_BOOTSTRAP_URL = "https://www.threads.com/";
export const UNOFFICIAL_DOC_ID = "28976933078608790";
export const UNOFFICIAL_OPERATION_NAME = "BarcelonaSearchResultsQuery";
export const UNOFFICIAL_ROOT_FIELD = "xdt_api__v1__text_feed__search_results__connection_v2";

/** App-ID web Threads (publik, terlihat di setiap request web app). */
export const UNOFFICIAL_APP_ID = "238260118697367";
export const UNOFFICIAL_ASBD_ID = "359341";
export const UNOFFICIAL_BLOKS_VERSION = "eb91d73a91a524be8e4f4d5e3793a8eada30ccc66f6990edc31e5ddf8c1c3a2c";
export const UNOFFICIAL_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

/** Key PlatformSecret untuk cookie sesi lengkap (format "k=v; k=v"). */
export const SECRET_THREADS_WEB_COOKIE = "threads_web_cookie";

export type UnofficialCredentials = {
  /** Cookie string lengkap, mis. "sessionid=...; csrftoken=...; ds_user_id=..." */
  cookie: string;
  /** Nilai csrftoken, selalu hasil baca dari cookie di atas. */
  csrf: string;
};

/** Token berumur pendek yang diambil dari halaman Threads, bukan dari operator. */
export type UnofficialSessionTokens = {
  fbDtsg: string;
  lsd: string;
  jazoest: string;
};

const COOKIE_KEYS = ["sessionid", "csrftoken", "ds_user_id"] as const;

/** Membaca satu nilai dari cookie string. Mengembalikan "" bila tidak ada. */
export function readCookieValue(cookie: string, name: string): string {
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim().toLowerCase() !== name.toLowerCase()) continue;
    return part.slice(separator + 1).trim();
  }
  return "";
}

/**
 * Mengembalikan kredensial tidak resmi jika cookie yang diisi Superadmin
 * memuat semua kunci sesi. Mengembalikan null bila belum lengkap — pemanggil
 * wajib menangani fallback.
 */
export function parseUnofficialCredentials(cookie: string): UnofficialCredentials | null {
  const normalized = cookie.trim();
  if (!normalized) return null;

  const missing = COOKIE_KEYS.some(key => !readCookieValue(normalized, key));
  if (missing) return null;

  return { cookie: normalized, csrf: readCookieValue(normalized, "csrftoken") };
}

/**
 * jazoest yang diharapkan Meta: "2" diikuti jumlah charcode fb_dtsg modulo
 * 100000. Nilai yang tidak cocok membuat request ditolak.
 */
export function computeJazoest(fbDtsg: string): string {
  let sum = 0;
  for (let index = 0; index < fbDtsg.length; index += 1) sum += fbDtsg.charCodeAt(index);
  return `2${sum % 100000}`;
}

const DTSG_PATTERN = /\["DTSGInitialData"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/;
const LSD_PATTERN = /\["LSD"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([A-Za-z0-9_-]{16,})"/;

/**
 * Mengambil fb_dtsg & lsd dari HTML halaman Threads. Mengembalikan null bila
 * tidak ditemukan — biasanya berarti cookie sudah tidak masuk (Threads
 * menyajikan halaman logged-out yang tidak memuat token ini).
 */
export function extractSessionTokens(html: string): UnofficialSessionTokens | null {
  const dtsg = html.match(DTSG_PATTERN)?.[1];
  const lsd = html.match(LSD_PATTERN)?.[1];
  if (!dtsg || !lsd) return null;
  return { fbDtsg: dtsg, lsd, jazoest: computeJazoest(dtsg) };
}

/**
 * Flag provider Relay yang wajib ikut di setiap query. Server GraphQL menolak
 * eksekusi bila salah satu hilang; nilainya menyalin apa yang dikirim web app.
 */
export const UNOFFICIAL_RELAY_PROVIDERS: Record<string, boolean> = {
  __relay_internal__pv__BarcelonaHasSERPHeaderrelayprovider: true,
  __relay_internal__pv__BarcelonaHasCommunitiesOrLoggedOutrelayprovider: true,
  __relay_internal__pv__BarcelonaHasWebFaviconsrelayprovider: false,
  __relay_internal__pv__BarcelonaHasCommunityGreenDotrelayprovider: false,
  __relay_internal__pv__BarcelonaMessagesHasLiveChatMessagingrelayprovider: false,
  __relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider: false,
  __relay_internal__pv__BarcelonaHasCommunityBobbleheadsrelayprovider: false,
  __relay_internal__pv__BarcelonaHasCommunityTrendingBadgingrelayprovider: false,
  __relay_internal__pv__BarcelonaIsLoggedInrelayprovider: true,
  __relay_internal__pv__BarcelonaShouldFetchPostAuthorFullNamerelayprovider: false,
  __relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider: false,
  __relay_internal__pv__BarcelonaHasMetaAiContentAttachmentsrelayprovider: false,
  __relay_internal__pv__BarcelonaHasEventBadgerelayprovider: false,
  __relay_internal__pv__BarcelonaHasBestOfThreadsrelayprovider: false,
  __relay_internal__pv__BarcelonaMessagingHasMetaAIBotrelayprovider: false,
  __relay_internal__pv__BarcelonaGenAIRepliesEnabledrelayprovider: false,
  __relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider: false,
  __relay_internal__pv__BarcelonaHasCommunitiesrelayprovider: true,
  __relay_internal__pv__BarcelonaHasGameScoreSharerelayprovider: false,
  __relay_internal__pv__BarcelonaHasPublicViewCountCardrelayprovider: false,
  __relay_internal__pv__BarcelonaHasCommunityEmojiUpdateCardrelayprovider: false,
  __relay_internal__pv__BarcelonaHasCommunityEntityCardrelayprovider: false,
  __relay_internal__pv__BarcelonaHasScorecardCommunityrelayprovider: false,
  __relay_internal__pv__BarcelonaHasSportTeamAllegianceCardrelayprovider: false,
  __relay_internal__pv__BarcelonaHasNewspaperLinkStylerelayprovider: false,
  __relay_internal__pv__BarcelonaHasMessagingrelayprovider: true,
  __relay_internal__pv__BarcelonaHasPodcastV2Consumptionrelayprovider: false,
  __relay_internal__pv__BarcelonaHasPodcastTranscriptConsumptionrelayprovider: false,
  __relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider: false,
  __relay_internal__pv__BarcelonaShouldFulfillLightboxQueryrelayprovider: false,
  __relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider: false,
  __relay_internal__pv__BarcelonaIsCrawlerrelayprovider: false,
  __relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider: false,
  __relay_internal__pv__BarcelonaHasUnseenRepliesrelayprovider: false,
  __relay_internal__pv__BarcelonaHasCustomLikesConsumptionrelayprovider: false,
  __relay_internal__pv__BarcelonaHasViewerRepliedrelayprovider: false,
  __relay_internal__pv__BarcelonaHasPrivateRepliesDeprecationrelayprovider: false,
  __relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider: false,
  __relay_internal__pv__BarcelonaHasGhostPostProductionrelayprovider: false,
  __relay_internal__pv__BarcelonaHasNewsletterLinkPreviewrelayprovider: false,
  __relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider: false,
  __relay_internal__pv__BarcelonaIsInternalUserrelayprovider: false,
};
