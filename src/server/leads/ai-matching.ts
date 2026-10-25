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

/**
 * Ambang vonis "cocok" yang dipakai feed dan email ringkasan.
 *
 * 80, bukan 60. Dua alasan. Pertama, yang diminta pemilik bisnis adalah lead
 * yang benar-benar layak ditanggapi, bukan daftar panjang yang harus disaring
 * ulang dengan mata. Kedua, `relevanceScore` berlantai 70 karena rumusnya
 * `70 + rasio * 30`, jadi ambang 60 tidak pernah menolak apa pun pada jalur
 * heuristik; 80 membuat angka itu akhirnya berarti.
 */
export const MATCH_THRESHOLD = 80;

/**
 * Banyaknya postingan yang dinilai dalam satu permintaan ke penyedia AI.
 *
 * Dulu satu postingan berarti satu permintaan. Dengan 25 postingan per kata
 * kunci itu 25 permintaan, dan yang dibatasi kuota penyedia adalah jumlah
 * permintaan, bukan jumlah token. Itulah yang memicu 429 berulang kali.
 *
 * Delapan sekaligus membuat 25 postingan selesai dalam 4 permintaan. Tidak
 * lebih besar dari itu karena satu jawaban harus memuat seluruh vonis
 * rombongannya, dan jawaban yang terpotong lebih mahal daripada satu
 * permintaan tambahan.
 */
export const AI_BATCH_SIZE = 8;

/** Satu postingan yang menunggu dinilai. */
export type LeadCandidate = {
  externalPostId: string;
  keyword: string;
  body: string;
};

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
 * Prompt untuk satu rombongan postingan sekaligus.
 *
 * Profil bisnisnya ditulis sekali di atas, lalu postingannya bernomor. Itu
 * sebabnya menggabungkan lebih murah: konteks bisnis tidak diulang untuk tiap
 * postingan seperti ketika tiap postingan punya permintaannya sendiri.
 *
 * Kutipannya lebih pendek daripada mode tunggal (600, bukan 1200) karena yang
 * menentukan maksud hampir selalu ada di kalimat pembuka, dan memendekkannya
 * memberi ruang untuk lebih banyak postingan dalam satu permintaan.
 */
export function buildBatchPrompt(business: BusinessContext, items: LeadCandidate[]) {
  const posts = items.map((item, index) => [
    `--- POSTINGAN ${index + 1} ---`,
    `Kata kunci yang menemukannya: ${item.keyword}`,
    item.body.slice(0, 600),
  ].join("\n"));

  return [
    "Anda menilai beberapa postingan Threads sekaligus untuk satu bisnis.",
    "",
    "BISNIS",
    `Nama: ${business.name}`,
    `Kategori: ${business.category}`,
    `Area layanan: ${business.serviceArea}`,
    `Deskripsi: ${business.description}`,
    "",
    ...posts,
    "",
    `Nilai SETIAP postingan di atas, seluruhnya ${items.length} buah.`,
    "Tentukan apakah penulis tiap postingan berpotensi menjadi pelanggan bisnis di atas.",
    "Penting: postingan yang justru MENAWARKAN jasa sejenis bukan calon pelanggan.",
    "Postingan di bidang yang berbeda juga bukan calon pelanggan meski memuat kata kunci yang sama.",
    "",
    'Jawab HANYA satu array JSON tanpa teks lain, satu objek per postingan, berbentuk:',
    '[{"i": <nomor postingan>, "score": <0-100>, "verdict": "MATCH"|"NO_MATCH"|"UNSURE", "reason": "<alasan maksimal 12 kata, bahasa Indonesia>"}]',
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

/**
 * Vonis per nomor postingan dari satu jawaban rombongan.
 *
 * Hasil sebagian sengaja diterima. Jawaban yang terpotong di tengah array
 * tetap memuat vonis yang sudah utuh di depannya, dan membuang semuanya
 * berarti menilai ulang postingan yang sebenarnya sudah dijawab. Yang tidak
 * terbaca dibiarkan kosong, lalu jatuh ke heuristik satu per satu.
 *
 * Objek tunggal tanpa array juga diterima, karena untuk rombongan berisi satu
 * postingan model kerap menjawab begitu.
 */
export function parseBatchJudgements(text: string): Map<number, { score: number; verdict: AiVerdict; reason: string | null }> {
  const out = new Map<number, { score: number; verdict: AiVerdict; reason: string | null }>();

  // Tiap objek dipindai sendiri, bukan lewat satu JSON.parse atas seluruh
  // array, supaya ekor yang terpotong tidak menjatuhkan awal yang baik.
  const objects = text.match(/\{[^{}]*\}/g);
  if (!objects) return out;

  objects.forEach((chunk, order) => {
    const judgement = parseJudgement(chunk);
    if (!judgement) return;
    let index: number;
    try {
      const raw = (JSON.parse(chunk) as Record<string, unknown>).i;
      const parsed = typeof raw === "number" ? raw : Number(raw);
      index = Number.isFinite(parsed) ? parsed : order + 1;
    } catch {
      index = order + 1;
    }
    if (!out.has(index)) out.set(index, judgement);
  });

  return out;
}

/** Kegagalan yang akan terulang pada permintaan berikutnya ke penyedia yang sama. */
function willRepeat(failure: AiFailure) {
  return failure === "NO_FUNDS"
    || failure === "UNAUTHORIZED"
    || failure === "UNCONFIGURED"
    || failure === "FREE_TIER_BLOCKED"
    || failure === "RATE_LIMITED";
}

/**
 * Menilai banyak postingan dengan sesedikit mungkin permintaan.
 *
 * Mengembalikan peta berkunci `externalPostId`, selalu lengkap: postingan yang
 * tidak terjawab AI tetap mendapat skor heuristik dengan vonis `UNKNOWN`,
 * supaya pencarian tidak pernah gagal hanya karena penyedia AI bermasalah.
 *
 * Begitu satu rombongan gagal dengan sebab yang pasti terulang, sisanya tidak
 * dikirim sama sekali: kuota yang sudah habis tidak pulih di permintaan
 * berikutnya, dan menabraknya berulang kali hanya memperlama pencarian.
 */
export async function judgeLeads(
  business: BusinessContext,
  items: LeadCandidate[],
  client: AiClient = getAiClient(),
): Promise<Map<string, LeadJudgement>> {
  const out = new Map<string, LeadJudgement>();
  const fallback = (item: LeadCandidate, failure: AiFailure): LeadJudgement => ({
    score: relevanceScore(item.body, item.keyword),
    verdict: "UNKNOWN",
    reason: null,
    model: null,
    failure,
  });

  if (items.length === 0) return out;
  if (!client.configured) {
    for (const item of items) out.set(item.externalPostId, fallback(item, "UNCONFIGURED"));
    return out;
  }

  let stoppedBy: AiFailure | null = null;

  for (let start = 0; start < items.length; start += AI_BATCH_SIZE) {
    const batch = items.slice(start, start + AI_BATCH_SIZE);

    if (stoppedBy) {
      for (const item of batch) out.set(item.externalPostId, fallback(item, stoppedBy));
      continue;
    }

    // Anggaran jawaban tumbuh bersama rombongan: satu vonis sekitar 40 token,
    // ditambah ruang untuk penalaran model.
    const maxTokens = 320 + batch.length * 120;
    const completion = await client
      .complete(buildBatchPrompt(business, batch), maxTokens)
      .catch(() => null);

    if (completion === null || !completion.ok) {
      const failure: AiFailure = completion === null ? "REQUEST_FAILED" : completion.code;
      if (willRepeat(failure)) stoppedBy = failure;
      for (const item of batch) out.set(item.externalPostId, fallback(item, failure));
      continue;
    }

    const judgements = parseBatchJudgements(completion.text);
    batch.forEach((item, offset) => {
      const judgement = judgements.get(offset + 1);
      out.set(
        item.externalPostId,
        judgement
          ? { ...judgement, model: completion.model, failure: null }
          : fallback(item, "BAD_RESPONSE"),
      );
    });
  }

  return out;
}

/** Menilai satu postingan. Jalur ini dipakai probe dan pengujian. */
export async function judgeLead(
  business: BusinessContext,
  keyword: string,
  postBody: string,
  client: AiClient = getAiClient(),
): Promise<LeadJudgement> {
  const id = "single";
  const judged = await judgeLeads(business, [{ externalPostId: id, keyword, body: postBody }], client);
  return judged.get(id) ?? {
    score: relevanceScore(postBody, keyword),
    verdict: "UNKNOWN",
    reason: null,
    model: null,
    failure: "REQUEST_FAILED",
  };
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
  // Vonis NO_MATCH menang mutlak: model sudah membaca isinya dan menolaknya.
  if (verdict === "NO_MATCH") return false;
  if (intent === "menawarkan") return false;
  // Angkanya berlaku untuk semua vonis, MATCH sekalipun. Sebelumnya MATCH
  // lolos berapa pun skornya, jadi "cocok menurut AI tapi hanya 45" tetap
  // masuk kotak masuk orang. Yang diminta adalah lead yang layak ditanggapi,
  // dan satu ambang untuk semua jalur membuat angka di kartu lead berarti
  // sama di mana pun ia muncul.
  return score >= MATCH_THRESHOLD;
}
