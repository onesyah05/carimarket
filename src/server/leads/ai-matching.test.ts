import { describe, expect, it } from "vitest";
import { buildPrompt, isMatch, judgeLead, parseJudgement, MATCH_THRESHOLD } from "./ai-matching";
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
  it("mengikuti vonis AI apa pun angkanya", () => {
    expect(isMatch("MATCH", 0)).toBe(true);
    expect(isMatch("NO_MATCH", 99)).toBe(false);
  });

  it("jatuh ke ambang angka ketika AI ragu atau tidak menilai", () => {
    expect(isMatch("UNKNOWN", MATCH_THRESHOLD)).toBe(true);
    expect(isMatch("UNKNOWN", MATCH_THRESHOLD - 1)).toBe(false);
    expect(isMatch("UNSURE", MATCH_THRESHOLD)).toBe(true);
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
