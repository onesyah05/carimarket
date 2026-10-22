import "server-only";

/**
 * Klien OpenCode Zen.
 *
 * Dipanggil langsung ke REST API-nya seperti integrasi Resend dan Meta di
 * proyek ini: satu dependensi lebih sedikit dan bentuk permintaannya terlihat
 * apa adanya.
 *
 * Yang tidak pernah masuk log: API key dan isi postingan. Saat gagal yang
 * dicatat hanya kode singkat, karena alasan kegagalan di sini menentukan
 * tindakan yang berbeda — saldo habis perlu diisi, sedangkan tier gratis
 * memang tidak dapat dipakai dari server.
 */

const DEFAULT_BASE_URL = "https://opencode.ai/zen/v1";
const DEFAULT_MODEL = "claude-haiku-5-5";

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
    baseUrl: (process.env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export function getAiClient(): AiClient {
  const { apiKey, baseUrl, model } = aiConfig();
  if (!apiKey) return { configured: false, model, async complete() { return { ok: false, code: "UNCONFIGURED" }; } };

  return {
    configured: true,
    model,
    async complete(prompt: string, maxTokens = 200): Promise<AiCompletion> {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, messages: [{ role: "user", content: prompt }] }),
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
      } catch (cause) {
        return { ok: false, code: cause instanceof Error && cause.name === "TimeoutError" ? "TIMEOUT" : "REQUEST_FAILED" };
      }

      if (!response.ok) return { ok: false, code: await failureFor(response) };

      const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: unknown } }> } | null;
      const text = payload?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || text.trim() === "") return { ok: false, code: "BAD_RESPONSE" };
      return { ok: true, text, model };
    },
  };
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
  UNCONFIGURED: "AI_API_KEY belum diisi, jadi penilaian AI tidak dijalankan.",
  NO_FUNDS: "Saldo akun OpenCode habis. Isi saldo agar penilaian AI berjalan kembali.",
  FREE_TIER_BLOCKED: "Model tier gratis OpenCode hanya dapat dipakai dari aplikasi OpenCode, bukan dari server. Pilih model berbayar lewat AI_MODEL.",
  UNAUTHORIZED: "API key AI ditolak. Perbarui AI_API_KEY.",
  RATE_LIMITED: "Permintaan ke penyedia AI dibatasi sementara.",
  TIMEOUT: "Penyedia AI tidak menjawab tepat waktu.",
  BAD_RESPONSE: "Jawaban penyedia AI tidak dapat dibaca.",
  REQUEST_FAILED: "Permintaan ke penyedia AI gagal.",
};
