import "server-only";
import { getAiClient, type AiClient, type AiFailure } from "@/server/integrations/ai/opencode-client";
import type { LeadIntent } from "@/lib/lead-intent";
import { relevanceScore } from "./matching";

/**
 * Menilai apakah sebuah postingan benar-benar calon pelanggan bagi satu bisnis.
 *
 * Kata kunci saja sering keliru: "rental mobil Jakarta Barat" memuat kata
 * "jasa" dan lolos penyaringan kata kunci milik studio desain, padahal jelas
 * bukan calon pelanggannya. Yang membedakan hanya pemahaman isi, jadi di sini
 * modelnya diberi profil bisnis dan isi postingan lalu diminta memutuskan.
 *
 * Penilaian ini tidak boleh menjadi titik gagal pencarian. Bila penyedia AI
 * mati, kehabisan saldo, atau menjawab aneh, hasilnya turun ke skor heuristik
 * yang lama dengan vonis `UNKNOWN` — lead tetap masuk, hanya tidak bertanda
 * "cocok menurut AI". Itu sebabnya fungsi ini tidak pernah melempar.
 */

export type AiVerdict = "MATCH" | "NO_MATCH" | "UNSURE" | "UNKNOWN";

export type LeadJudgement = {
  score: number;
  verdict: AiVerdict;
  reason: string | null;
  model: string | null;
  /** Terisi hanya bila penilaian AI tidak dapat dijalankan. */
  failure: AiFailure | null;
};

export type BusinessContext = {
  name: string;
  category: string;
  serviceArea: string;
  description: string;
};

/** Ambang vonis "cocok" yang dipakai feed dan email ringkasan. */
export const MATCH_THRESHOLD = 60;

export function buildPrompt(business: BusinessContext, keyword: string, postBody: string) {
  // Postingan dipotong karena hanya pembukanya yang menentukan maksud, dan
  // utas panjang membuat biaya per lead naik tanpa menambah ketepatan.
  const excerpt = postBody.slice(0, 1200);
  return [
    "Anda menilai apakah sebuah postingan Threads adalah calon pelanggan untuk sebuah bisnis.",
    "",
    "BISNIS",
    `Nama: ${business.name}`,
    `Kategori: ${business.category}`,
    `Area layanan: ${business.serviceArea}`,
    `Deskripsi: ${business.description}`,
    "",
    `KATA KUNCI YANG MENEMUKAN POSTINGAN INI: ${keyword}`,
    "",
    "POSTINGAN",
    excerpt,
    "",
    "Tentukan apakah penulis postingan berpotensi menjadi pelanggan bisnis di atas.",
    "Penting: postingan yang justru MENAWARKAN jasa sejenis bukan calon pelanggan.",
    "Postingan di bidang yang berbeda juga bukan calon pelanggan meski memuat kata kunci yang sama.",
    "",
    'Jawab HANYA satu objek JSON tanpa teks lain, berbentuk: {"score": <0-100>, "verdict": "MATCH"|"NO_MATCH"|"UNSURE", "reason": "<alasan maksimal 12 kata, bahasa Indonesia>"}',
  ].join("\n");
}

/**
 * Model kadang membungkus JSON dengan pagar kode atau kalimat pengantar, jadi
 * yang diambil adalah objek pertama yang utuh, bukan seluruh balasan.
 */
export function parseJudgement(text: string): { score: number; verdict: AiVerdict; reason: string | null } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  const rawVerdict = typeof record.verdict === "string" ? record.verdict.toUpperCase().replace(/[\s-]/g, "_") : "";
  if (rawVerdict !== "MATCH" && rawVerdict !== "NO_MATCH" && rawVerdict !== "UNSURE") return null;

  const rawScore = typeof record.score === "number" ? record.score : Number(record.score);
  if (!Number.isFinite(rawScore)) return null;

  const reason = typeof record.reason === "string" && record.reason.trim() !== "" ? record.reason.trim().slice(0, 200) : null;
  return { score: Math.max(0, Math.min(100, Math.round(rawScore))), verdict: rawVerdict, reason };
}

export async function judgeLead(
  business: BusinessContext,
  keyword: string,
  postBody: string,
  client: AiClient = getAiClient(),
): Promise<LeadJudgement> {
  const fallback = (failure: AiFailure): LeadJudgement => ({
    score: relevanceScore(postBody, keyword),
    verdict: "UNKNOWN",
    reason: null,
    model: null,
    failure,
  });

  if (!client.configured) return fallback("UNCONFIGURED");

  const completion = await client.complete(buildPrompt(business, keyword, postBody)).catch(() => null);
  if (completion === null) return fallback("REQUEST_FAILED");
  if (!completion.ok) return fallback(completion.code);

  const judgement = parseJudgement(completion.text);
  if (judgement === null) return fallback("BAD_RESPONSE");

  return { ...judgement, model: completion.model, failure: null };
}

/**
 * Lead yang boleh disebut "cocok".
 *
 * Produk ini mencari calon pelanggan, jadi yang dicari adalah orang yang
 * sedang MEMBUTUHKAN jasa — bukan orang yang menawarkannya. Postingan yang
 * menawarkan jasa sejenis adalah pesaing, dan sebelumnya ia tetap muncul
 * sebagai "100% cocok" karena niat postingan hanya dipakai sebagai label dan
 * tidak pernah ikut menentukan kecocokan.
 *
 * Angka saja tidak bisa menggantikannya: `relevanceScore` berlantai 70 karena
 * rumusnya `70 + rasio * 30`, sehingga ambang berapa pun di bawah itu tidak
 * pernah menolak apa pun. Tanpa AI, niat postingan adalah satu-satunya sinyal
 * yang benar-benar membedakan.
 *
 * Vonis AI tetap menang bila ada, karena ia membaca isinya dan bukan menebak
 * dari pola kalimat.
 */
export function isMatch(verdict: AiVerdict, score: number, intent: LeadIntent) {
  if (verdict === "MATCH") return true;
  if (verdict === "NO_MATCH") return false;
  if (intent === "menawarkan") return false;
  // UNSURE dan UNKNOWN jatuh ke angka, supaya matinya AI tidak mengosongkan
  // feed maupun email ringkasan.
  return score >= MATCH_THRESHOLD;
}
