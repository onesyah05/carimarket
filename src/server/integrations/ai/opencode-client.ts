import "server-only";

/**
 * Klien penyedia AI yang berbicara protokol OpenAI (`/chat/completions`).
 *
 * Dipanggil langsung ke REST API-nya seperti integrasi Resend dan Meta di
 * proyek ini: satu dependensi lebih sedikit dan bentuk permintaannya terlihat
 * apa adanya. Host dan modelnya datang dari env, bukan dipaku di sini, karena
 * penyedianya sudah berganti sekali dan kemungkinan berganti lagi.
 *
 * Yang tidak pernah masuk log: API key dan isi postingan. Saat gagal yang
 * dicatat hanya kode singkat, karena alasan kegagalan di sini menentukan
 * tindakan yang berbeda — saldo habis perlu diisi, sedangkan tier gratis
 * memang tidak dapat dipakai dari server.
 */

const DEFAULT_MODEL = "mimo-v2.6-flash-free";

/**
 * Anggaran token jawaban.
 *
 * Besar karena model penalaran membelanjakan token untuk berpikir SEBELUM
 * menulis jawaban, dan porsi itu masuk hitungan yang sama. Dengan anggaran 200
 * token, seluruhnya habis di penalaran: `finish_reason` kembali "length",
 * `content` kembali null, dan tiap lead jatuh ke heuristik meski penyedianya
 * sehat. Pengukuran pada model sekarang: ~60 token penalaran + ~40 token JSON.
 */
const DEFAULT_MAX_TOKENS = 600;

/**
 * Model penalaran menjawab lebih lama daripada model biasa — terukur 5–9 detik
 * per postingan, dan lebih lama lagi saat beberapa permintaan berjalan
 * bersamaan. Batas 20 detik yang lama memotong jawaban yang sebenarnya sudah
 * di jalan.
 */
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Sebab kegagalan yang dibedakan karena tindakannya berbeda.
 *
 * `NO_FUNDS` dan `FREE_TIER_BLOCKED` keduanya berarti "akun ini belum dapat
 * dipakai", tetapi yang pertama selesai dengan mengisi saldo dan yang kedua
 * tidak akan pernah berhasil dari server berapa pun saldonya.
 */
export type AiFailure =
  | "UNCONFIGURED"
  | "NO_FUNDS"
  | "FREE_TIER_BLOCKED"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "BAD_RESPONSE"
  | "REQUEST_FAILED";

export type AiCompletion =
  | { ok: true; text: string; model: string }
  | { ok: false; code: AiFailure };

export type AiClient = {
  readonly configured: boolean;
  readonly model: string;
  complete(prompt: string, maxTokens?: number): Promise<AiCompletion>;
};

export function aiConfig() {
  return {
    apiKey: process.env.AI_API_KEY?.trim() ?? "",
    baseUrl: (process.env.AI_BASE_URL?.trim() ?? "").replace(/\/+$/, ""),
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

/**
 * Bentuk jawaban `/chat/completions`.
 *
 * `reasoning` bukan bagian spesifikasi OpenAI, tetapi model penalaran
 * mengirimkannya berdampingan dengan `content` — dan ketika jawabannya
 * terpotong, `content` bisa null sementara `reasoning` sudah terisi.
 */
type ChatCompletion = {
  choices?: Array<{ message?: { content?: unknown; reasoning?: unknown } }>;
};

export function getAiClient(): AiClient {
  const { apiKey, baseUrl, model } = aiConfig();
  // Host ikut menentukan "terkonfigurasi": penyedianya tidak lagi punya alamat
  // bawaan, jadi key tanpa host sama tidak dapat dipakainya dengan host tanpa
  // key — dan diam-diam menembak alamat yang salah lebih sulit didiagnosis.
  if (!apiKey || !baseUrl) return { configured: false, model, async complete() { return { ok: false, code: "UNCONFIGURED" }; } };

  return {
    configured: true,
    model,
    async complete(prompt: string, maxTokens = DEFAULT_MAX_TOKENS): Promise<AiCompletion> {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, messages: [{ role: "user", content: prompt }] }),
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (cause) {
        return { ok: false, code: cause instanceof Error && cause.name === "TimeoutError" ? "TIMEOUT" : "REQUEST_FAILED" };
      }

      if (!response.ok) return { ok: false, code: await failureFor(response) };

      const payload = await response.json().catch(() => null) as ChatCompletion | null;
      const text = messageText(payload);
      if (text === null) return { ok: false, code: "BAD_RESPONSE" };
      return { ok: true, text, model };
    },
  };
}

/**
 * Teks jawaban, dari `content` bila ada dan dari `reasoning` bila tidak.
 *
 * Model penalaran menaruh jawaban akhirnya di `content` dan uraian pikirannya
 * di `reasoning`. Keduanya dibaca karena saat anggaran token mepet `content`
 * kembali null padahal `reasoning` kadang sudah memuat JSON yang diminta;
 * membacanya berarti jawaban yang nyaris jadi tidak terbuang. Pembacanya
 * (`parseJudgement`) memang hanya mengambil objek JSON pertama yang utuh, jadi
 * uraian pikiran yang tidak memuat JSON tetap ditolak seperti sebelumnya.
 */
function messageText(payload: ChatCompletion | null): string | null {
  const message = payload?.choices?.[0]?.message;
  for (const candidate of [message?.content, message?.reasoning]) {
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
  }
  return null;
}

async function failureFor(response: Response): Promise<AiFailure> {
  // Pesannya dibaca karena 403 dipakai untuk dua hal yang berbeda, dan hanya
  // teksnya yang membedakan tier gratis dari key yang ditolak.
  const detail = await response.text().catch(() => "");
  if (response.status === 402) return "NO_FUNDS";
  if (response.status === 403) return /free tier/i.test(detail) ? "FREE_TIER_BLOCKED" : "UNAUTHORIZED";
  if (response.status === 401) return "UNAUTHORIZED";
  if (response.status === 429) return "RATE_LIMITED";
  if (/insufficient.*funds/i.test(detail)) return "NO_FUNDS";
  return "REQUEST_FAILED";
}

/** Pesan untuk konsol internal; tidak pernah ditampilkan ke pengguna akhir. */
export const AI_FAILURE_MESSAGE: Record<AiFailure, string> = {
  UNCONFIGURED: "AI_API_KEY atau AI_BASE_URL belum diisi, jadi penilaian AI tidak dijalankan.",
  NO_FUNDS: "Saldo akun penyedia AI habis. Isi saldo agar penilaian AI berjalan kembali.",
  FREE_TIER_BLOCKED: "Penyedia menolak model ini dari server. Pilih model lain lewat AI_MODEL.",
  UNAUTHORIZED: "API key AI ditolak. Perbarui AI_API_KEY.",
  RATE_LIMITED: "Permintaan ke penyedia AI dibatasi sementara.",
  TIMEOUT: "Penyedia AI tidak menjawab tepat waktu.",
  BAD_RESPONSE: "Jawaban penyedia AI tidak dapat dibaca.",
  REQUEST_FAILED: "Permintaan ke penyedia AI gagal.",
};
