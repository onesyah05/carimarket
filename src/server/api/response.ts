/**
 * Format respons tunggal untuk seluruh API mobile (`/api/v1`).
 *
 * Setiap respons, berhasil maupun gagal, memakai amplop yang sama sehingga
 * klien hanya perlu satu jalur penguraian:
 *
 *   { "success": true,  "data": <payload>, "meta": { ... } }
 *   { "success": false, "error": { "code", "message", "details" }, "meta": { ... } }
 *
 * `meta` selalu memuat `requestId` dan `timestamp`; endpoint berbentuk daftar
 * menambahkan `page`.
 *
 * Modul ini murni agar bentuk amplop dapat diuji tanpa server.
 */

export type ApiMeta = {
  requestId: string;
  timestamp: string;
  page?: ApiPageMeta;
};

export type ApiPageMeta = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export type ApiSuccessBody<T> = { success: true; data: T; meta: ApiMeta };
export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string; details: Record<string, string> | null };
  meta: ApiMeta;
};

export const API_VERSION = "v1";
export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

export function buildMeta(requestId: string, page?: ApiPageMeta, now = new Date()): ApiMeta {
  return { requestId, timestamp: now.toISOString(), ...(page ? { page } : {}) };
}

export function successBody<T>(data: T, meta: ApiMeta): ApiSuccessBody<T> {
  return { success: true, data, meta };
}

export function errorBody(code: string, message: string, meta: ApiMeta, details?: Record<string, string> | null): ApiErrorBody {
  return { success: false, error: { code, message, details: details ?? null }, meta };
}

/** Halaman daftar: membatasi nilai yang dikirim klien ke rentang yang wajar. */
export function resolvePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Math.trunc(Number(searchParams.get("page")) || 1));
  const requested = Math.trunc(Number(searchParams.get("perPage")) || DEFAULT_PER_PAGE);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, requested));
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

export function pageMeta(page: number, perPage: number, total: number): ApiPageMeta {
  const totalPages = perPage > 0 ? Math.ceil(total / perPage) : 0;
  return { page, perPage, total, totalPages, hasMore: page < totalPages };
}

/**
 * Kode error yang dipakai API mobile. Didaftarkan di satu tempat agar
 * dokumentasi dan implementasi tidak pernah berbeda.
 */
export const API_ERROR_CODES = {
  UNAUTHENTICATED: { status: 401, message: "Kredensial API tidak disertakan atau tidak dikenali." },
  INVALID_CREDENTIALS: { status: 401, message: "Email atau kata sandi belum tepat." },
  PASSWORD_NOT_SET: { status: 409, message: "Akun belum memiliki kata sandi, jadi belum dapat masuk dari aplikasi." },
  PAIRING_CODE_INVALID: { status: 400, message: "Kode pemasangan tidak dikenali." },
  PAIRING_CODE_USED: { status: 409, message: "Kode pemasangan sudah terpakai." },
  PAIRING_CODE_EXPIRED: { status: 409, message: "Kode pemasangan sudah kedaluwarsa." },
  CREDENTIAL_REVOKED: { status: 401, message: "Kredensial API sudah dicabut." },
  CREDENTIAL_EXPIRED: { status: 401, message: "Kredensial API sudah kedaluwarsa." },
  ACCOUNT_INACTIVE: { status: 403, message: "Akun workspace tidak aktif." },
  FORBIDDEN: { status: 403, message: "Kredensial ini tidak memiliki akses ke sumber daya tersebut." },
  NOT_FOUND: { status: 404, message: "Sumber daya tidak ditemukan." },
  INVALID_INPUT: { status: 400, message: "Permintaan tidak valid." },
  METHOD_NOT_ALLOWED: { status: 405, message: "Metode HTTP tidak didukung pada endpoint ini." },
  CONFLICT: { status: 409, message: "Permintaan bertentangan dengan kondisi sumber daya saat ini." },
  QUOTA_EXCEEDED: { status: 429, message: "Kuota paket sudah terpakai untuk periode ini." },
  RATE_LIMITED: { status: 429, message: "Terlalu banyak permintaan. Coba lagi sebentar lagi." },
  THREADS_UNAVAILABLE: { status: 409, message: "Integrasi Threads belum tersedia untuk workspace ini." },
  INTERNAL_ERROR: { status: 500, message: "Permintaan belum dapat diproses. Silakan coba lagi nanti." },
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODES;

export function statusForCode(code: string): number {
  return (API_ERROR_CODES as Record<string, { status: number } | undefined>)[code]?.status ?? 500;
}
