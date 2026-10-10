/**
 * Pembacaan error Meta tanpa akses jaringan maupun database.
 *
 * Tujuannya satu: kegagalan integrasi harus dapat didiagnosis dari log server
 * tanpa pernah membocorkan token atau secret. Pesan untuk pengguna tetap
 * disusun di tempat lain dan tetap umum.
 */

export type MetaDiagnostics = {
  httpStatus: number;
  code: number | null;
  subcode: number | null;
  type: string | null;
  message: string;
  traceId: string | null;
};

type MetaErrorShape = {
  error?: {
    message?: unknown;
    code?: unknown;
    error_subcode?: unknown;
    type?: unknown;
    fbtrace_id?: unknown;
  };
};

/** Pola nilai rahasia yang tidak boleh ikut ke log. */
const SECRET_PATTERNS: RegExp[] = [
  // Token Meta/Threads berbentuk beberapa segmen: TH|<app id>|<rahasia>.
  /\bTH[A-Za-z]*(?:\|[\w-]+)+/g,
  /\bEA[A-Za-z0-9]{20,}/g,
  /\b(?:access_token|client_secret|code|lsd|sessionid|csrftoken)=[^&\s"']+/gi,
  /\b[A-Za-z0-9_-]{40,}\b/g,
];

export function redactSecrets(value: string): string {
  let safe = value;
  for (const pattern of SECRET_PATTERNS) safe = safe.replace(pattern, "<disensor>");
  return safe;
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseMetaError(payload: unknown, httpStatus: number): MetaDiagnostics {
  const error = (payload as MetaErrorShape | null)?.error;
  return {
    httpStatus,
    code: asNumber(error?.code),
    subcode: asNumber(error?.error_subcode),
    type: asText(error?.type),
    message: redactSecrets(asText(error?.message) ?? "tanpa pesan dari Meta"),
    traceId: asText(error?.fbtrace_id),
  };
}

/** Satu baris ringkas untuk log server. Tidak pernah dikirim ke klien. */
export function describeMetaError(diagnostics: MetaDiagnostics): string {
  const parts = [
    `http=${diagnostics.httpStatus}`,
    `code=${diagnostics.code ?? "-"}`,
    `subcode=${diagnostics.subcode ?? "-"}`,
    `type=${diagnostics.type ?? "-"}`,
    `trace=${diagnostics.traceId ?? "-"}`,
    `message="${diagnostics.message}"`,
  ];
  return parts.join(" ");
}

/**
 * Kegagalan sementara di sisi Meta. Laporan komunitas menunjukkan penukaran
 * token jangka panjang kadang gagal beberapa menit lalu pulih sendiri, jadi
 * kasus ini layak dicoba ulang; error parameter atau izin tidak.
 */
export function isTransientMetaFailure(diagnostics: MetaDiagnostics): boolean {
  if (diagnostics.httpStatus >= 500) return true;
  if (diagnostics.httpStatus === 429) return true;
  if (diagnostics.code !== null && [0, 1, 2, 4, 17, 341, 368].includes(diagnostics.code)) return true;
  return /temporar|try again|please retry|unexpected error|rate limit/i.test(diagnostics.message);
}

/** Kode singkat yang aman disimpan di database dan ditampilkan ke Superadmin. */
export function metaErrorCode(diagnostics: MetaDiagnostics): string {
  const base = diagnostics.code === null ? `HTTP_${diagnostics.httpStatus}` : `META_${diagnostics.code}`;
  return (diagnostics.subcode === null ? base : `${base}_${diagnostics.subcode}`).slice(0, 100);
}
