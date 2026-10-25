import { describe, expect, it } from "vitest";
import { AI_BATCH_SIZE, buildBatchPrompt, buildPrompt, isMatch, judgeLead, judgeLeads, parseBatchJudgements, parseJudgement, MATCH_THRESHOLD } from "./ai-matching";
import type { AiClient } from "@/server/integrations/ai/opencode-client";

const business = {
  name: "Langit Visual",
  category: "Jasa kreatif",
  serviceArea: "Jabodetabek",
  description: "Studio desain grafis dan branding.",
};

function clientReturning(text: string): AiClient {
  return { configured: true, model: "test-model", async complete() { return { ok: true, text, model: "test-model" }; } };
}

describe("parseJudgement", () => {
  it("membaca objek JSON polos", () => {
    expect(parseJudgement('{"score":88,"verdict":"MATCH","reason":"butuh desain logo"}'))
      .toEqual({ score: 88, verdict: "MATCH", reason: "butuh desain logo" });
  });

  it("membaca JSON yang dibungkus pagar kode dan kalimat pengantar", () => {
    const text = 'Tentu.\n```json\n{"score": 12, "verdict": "no-match", "reason": "bidang berbeda"}\n```';
    expect(parseJudgement(text)).toEqual({ score: 12, verdict: "NO_MATCH", reason: "bidang berbeda" });
  });

  it("menjepit skor ke rentang 0-100 dan membulatkannya", () => {
    expect(parseJudgement('{"score":140.4,"verdict":"MATCH"}')?.score).toBe(100);
    expect(parseJudgement('{"score":-5,"verdict":"UNSURE"}')?.score).toBe(0);
  });

  it("menolak vonis yang tidak dikenal maupun skor yang bukan angka", () => {
    expect(parseJudgement('{"score":80,"verdict":"mungkin"}')).toBeNull();
    expect(parseJudgement('{"score":"tinggi","verdict":"MATCH"}')).toBeNull();
    expect(parseJudgement("bukan json sama sekali")).toBeNull();
  });
});

describe("judgeLead", () => {
  it("memakai vonis model ketika penyedia menjawab", async () => {
    const result = await judgeLead(business, "jasa desain logo", "Butuh jasa desain logo untuk UMKM", clientReturning('{"score":91,"verdict":"MATCH","reason":"mencari desain logo"}'));
    expect(result).toMatchObject({ score: 91, verdict: "MATCH", failure: null, model: "test-model" });
  });

  it("turun ke skor heuristik dengan vonis UNKNOWN saat saldo habis", async () => {
    const client: AiClient = { configured: true, model: "m", async complete() { return { ok: false, code: "NO_FUNDS" }; } };
    const result = await judgeLead(business, "jasa desain logo", "Butuh jasa desain logo sekarang", client);
    expect(result.verdict).toBe("UNKNOWN");
    expect(result.failure).toBe("NO_FUNDS");
    // Heuristiknya tetap memberi angka, jadi lead tidak hilang dari feed.
    expect(result.score).toBeGreaterThan(0);
  });

  it("turun ke heuristik ketika jawaban model tidak dapat dibaca", async () => {
    const result = await judgeLead(business, "jasa desain logo", "Butuh desain", clientReturning("maaf, saya tidak bisa menjawab"));
    expect(result.verdict).toBe("UNKNOWN");
    expect(result.failure).toBe("BAD_RESPONSE");
  });

  it("tidak memanggil penyedia bila kunci belum diisi", async () => {
    const client: AiClient = { configured: false, model: "m", async complete() { throw new Error("tidak boleh dipanggil"); } };
    const result = await judgeLead(business, "jasa desain logo", "Butuh desain", client);
    expect(result.failure).toBe("UNCONFIGURED");
  });
});

describe("isMatch", () => {
  it("menolak NO_MATCH berapa pun skornya", () => {
    // Vonis menolak menang mutlak: model sudah membaca isinya.
    expect(isMatch("NO_MATCH", 99, "mencari")).toBe(false);
    expect(isMatch("NO_MATCH", 100, "tidak jelas")).toBe(false);
  });

  it("menuntut MATCH ikut memenuhi ambang angka", () => {
    // Dulu MATCH lolos berapa pun skornya, jadi "cocok menurut AI tapi 45"
    // tetap masuk kotak masuk orang.
    expect(isMatch("MATCH", MATCH_THRESHOLD - 1, "mencari")).toBe(false);
    expect(isMatch("MATCH", MATCH_THRESHOLD, "mencari")).toBe(true);
    expect(isMatch("MATCH", 0, "menawarkan")).toBe(false);
  });

  it("memakai ambang 80, bukan angka di bawah lantai heuristik", () => {
    // relevanceScore berlantai 70, jadi ambang di bawah itu tidak pernah
    // menolak apa pun pada jalur tanpa AI.
    expect(MATCH_THRESHOLD).toBe(80);
    expect(isMatch("UNKNOWN", 70, "mencari")).toBe(false);
  });

  it("menolak postingan yang menawarkan jasa ketika AI belum menilai", () => {
    // Inti produknya: yang dicari adalah orang yang MEMBUTUHKAN jasa. Pesaing
    // yang sedang berjualan tidak pernah menjadi calon pelanggan.
    expect(isMatch("UNKNOWN", 100, "menawarkan")).toBe(false);
    expect(isMatch("UNSURE", 100, "menawarkan")).toBe(false);
  });

  it("menerima postingan yang mencari jasa", () => {
    expect(isMatch("UNKNOWN", MATCH_THRESHOLD, "mencari")).toBe(true);
    expect(isMatch("UNKNOWN", MATCH_THRESHOLD, "tidak jelas")).toBe(true);
  });

  it("jatuh ke ambang angka ketika AI ragu atau tidak menilai", () => {
    expect(isMatch("UNKNOWN", MATCH_THRESHOLD - 1, "mencari")).toBe(false);
    expect(isMatch("UNSURE", MATCH_THRESHOLD, "mencari")).toBe(true);
  });
});

describe("buildPrompt", () => {
  it("menyebut profil bisnis, kata kunci, dan isi postingan", () => {
    const prompt = buildPrompt(business, "jasa desain logo", "Butuh desain logo");
    expect(prompt).toContain("Langit Visual");
    expect(prompt).toContain("jasa desain logo");
    expect(prompt).toContain("Butuh desain logo");
  });

  it("memotong postingan yang sangat panjang", () => {
    const prompt = buildPrompt(business, "kata", "x".repeat(5000));
    expect(prompt).not.toContain("x".repeat(1300));
  });

  it("menyebut bahwa penawar jasa sejenis bukan calon pelanggan", () => {
    expect(buildPrompt(business, "kata", "isi")).toContain("MENAWARKAN");
  });
});

/**
 * Penilaian berombongan.
 *
 * Yang dikunci di sini bukan cuma "hasilnya benar", melainkan BERAPA KALI
 * penyedia dipanggil. Jumlah permintaan itulah yang dibatasi kuota dan yang
 * dulu memicu 429, jadi angka itu yang harus dijaga regresinya.
 */
describe("judgeLeads", () => {
  const candidates = (n: number) => Array.from({ length: n }, (_, i) => ({
    externalPostId: `p${i + 1}`,
    keyword: "jasa desain logo",
    body: `Butuh jasa desain logo nomor ${i + 1}`,
  }));

  function batchClient(reply: (prompt: string) => string) {
    const calls: string[] = [];
    const client: AiClient = {
      configured: true,
      model: "test-model",
      async complete(prompt: string) {
        calls.push(prompt);
        return { ok: true, text: reply(prompt), model: "test-model" };
      },
    };
    return { client, calls };
  }

  const arrayFor = (n: number, score = 90) =>
    JSON.stringify(Array.from({ length: n }, (_, i) => ({ i: i + 1, score, verdict: "MATCH", reason: "butuh jasa" })));

  it("menilai delapan postingan dalam satu permintaan, bukan delapan", async () => {
    const { client, calls } = batchClient(() => arrayFor(8));

    const judged = await judgeLeads(business, candidates(8), client);

    expect(calls).toHaveLength(1);
    expect(judged.size).toBe(8);
    expect(judged.get("p1")).toMatchObject({ score: 90, verdict: "MATCH", failure: null });
  });

  it("memecah 25 postingan menjadi 4 permintaan, bukan 25", async () => {
    const { client, calls } = batchClient(prompt => {
      const count = (prompt.match(/--- POSTINGAN /g) || []).length;
      return arrayFor(count);
    });

    const judged = await judgeLeads(business, candidates(25), client);

    expect(calls).toHaveLength(Math.ceil(25 / AI_BATCH_SIZE));
    expect(calls).toHaveLength(4);
    expect(judged.size).toBe(25);
  });

  it("menurunkan hanya postingan yang tidak dijawab ke heuristik", async () => {
    // Jawaban terpotong: dua vonis pertama utuh, sisanya hilang.
    const { client } = batchClient(() => '[{"i":1,"score":95,"verdict":"MATCH","reason":"butuh"},{"i":2,"score":88,"verdict":"MATCH","reason":"butuh"}');

    const judged = await judgeLeads(business, candidates(4), client);

    expect(judged.get("p1")).toMatchObject({ score: 95, failure: null });
    expect(judged.get("p2")).toMatchObject({ score: 88, failure: null });
    expect(judged.get("p3")).toMatchObject({ verdict: "UNKNOWN", failure: "BAD_RESPONSE" });
    expect(judged.get("p4")).toMatchObject({ verdict: "UNKNOWN", failure: "BAD_RESPONSE" });
  });

  it("berhenti memanggil penyedia setelah kuota habis", async () => {
    const calls: string[] = [];
    const client: AiClient = {
      configured: true,
      model: "m",
      async complete(prompt: string) {
        calls.push(prompt);
        return { ok: false, code: "RATE_LIMITED" };
      },
    };

    const judged = await judgeLeads(business, candidates(25), client);

    // Satu rombongan dicoba, sisanya tidak dikirim sama sekali.
    expect(calls).toHaveLength(1);
    expect(judged.size).toBe(25);
    expect(judged.get("p25")).toMatchObject({ verdict: "UNKNOWN", failure: "RATE_LIMITED" });
  });

  it("tetap mengembalikan vonis untuk tiap postingan tanpa penyedia", async () => {
    const client: AiClient = { configured: false, model: "m", async complete() { throw new Error("tidak boleh dipanggil"); } };

    const judged = await judgeLeads(business, candidates(3), client);

    expect(judged.size).toBe(3);
    expect([...judged.values()].every(j => j.failure === "UNCONFIGURED")).toBe(true);
    // Skor heuristik tetap ada, jadi lead tidak hilang dari feed.
    expect(judged.get("p1")!.score).toBeGreaterThan(0);
  });
});

describe("parseBatchJudgements", () => {
  it("memetakan vonis ke nomor postingan dari medan i", () => {
    const map = parseBatchJudgements('[{"i":2,"score":70,"verdict":"UNSURE"},{"i":1,"score":91,"verdict":"MATCH"}]');
    expect(map.get(1)).toMatchObject({ score: 91, verdict: "MATCH" });
    expect(map.get(2)).toMatchObject({ score: 70, verdict: "UNSURE" });
  });

  it("memakai urutan kemunculan ketika medan i tidak ada", () => {
    const map = parseBatchJudgements('[{"score":91,"verdict":"MATCH"},{"score":10,"verdict":"NO_MATCH"}]');
    expect(map.get(1)?.verdict).toBe("MATCH");
    expect(map.get(2)?.verdict).toBe("NO_MATCH");
  });

  it("menerima objek tunggal tanpa array", () => {
    const map = parseBatchJudgements('{"score":91,"verdict":"MATCH","reason":"butuh desain"}');
    expect(map.get(1)).toMatchObject({ score: 91, verdict: "MATCH" });
  });

  it("mengabaikan objek yang vonisnya tidak dikenal, bukan membuang seluruh array", () => {
    const map = parseBatchJudgements('[{"i":1,"score":91,"verdict":"MATCH"},{"i":2,"score":50,"verdict":"mungkin"}]');
    expect(map.get(1)?.verdict).toBe("MATCH");
    expect(map.has(2)).toBe(false);
  });
});

describe("buildBatchPrompt", () => {
  it("menulis profil bisnis sekali untuk seluruh rombongan", () => {
    const prompt = buildBatchPrompt(business, [
      { externalPostId: "a", keyword: "jasa desain logo", body: "Butuh logo" },
      { externalPostId: "b", keyword: "jasa desain logo", body: "Butuh banner" },
    ]);
    // Konteks bisnis tidak diulang per postingan; itu yang membuat
    // penggabungan lebih murah daripada dua permintaan terpisah.
    expect(prompt.match(/Langit Visual/g)).toHaveLength(1);
    expect(prompt).toContain("--- POSTINGAN 1 ---");
    expect(prompt).toContain("--- POSTINGAN 2 ---");
    expect(prompt).toContain("seluruhnya 2 buah");
  });

  it("menyebut bahwa penawar jasa sejenis bukan calon pelanggan", () => {
    expect(buildBatchPrompt(business, [{ externalPostId: "a", keyword: "k", body: "isi" }])).toContain("MENAWARKAN");
  });
});
