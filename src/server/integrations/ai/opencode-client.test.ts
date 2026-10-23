import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiConfig, getAiClient } from "./opencode-client";

/**
 * Pengujian terhadap bentuk jawaban penyedia, bukan terhadap jaringannya.
 *
 * Yang dikunci di sini adalah hal-hal yang pernah membuat penilaian AI diam
 * saja padahal penyedianya sehat: anggaran token yang terlalu kecil untuk
 * model penalaran, dan jawaban yang menaruh teksnya di `reasoning` sementara
 * `content` kembali null.
 */

const ORIGINAL = { ...process.env };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function completion(message: Record<string, unknown>) {
  return jsonResponse({ choices: [{ message }] });
}

beforeEach(() => {
  process.env.AI_API_KEY = "kunci-uji";
  process.env.AI_BASE_URL = "http://penyedia.uji/v1";
  process.env.AI_MODEL = "model-uji";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllGlobals();
});

describe("aiConfig", () => {
  it("membuang garis miring di ujung agar jalurnya tidak berganda", () => {
    process.env.AI_BASE_URL = "http://penyedia.uji/v1///";
    expect(aiConfig().baseUrl).toBe("http://penyedia.uji/v1");
  });
});

describe("getAiClient", () => {
  it("menembak /chat/completions dengan anggaran token yang cukup untuk model penalaran", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion({ content: "halo" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAiClient().complete("tanya");

    expect(result).toEqual({ ok: true, text: "halo", model: "model-uji" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://penyedia.uji/v1/chat/completions");
    const body = JSON.parse(String(init.body)) as { max_tokens: number; model: string };
    // Anggaran lama 200 token habis di penalaran sebelum jawaban ditulis.
    expect(body.max_tokens).toBeGreaterThanOrEqual(600);
    expect(body.model).toBe("model-uji");
  });

  it("tidak membocorkan API key ke tempat selain header Authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion({ content: "halo" }));
    vi.stubGlobal("fetch", fetchMock);

    await getAiClient().complete("tanya");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("kunci-uji");
    expect(String(init.body)).not.toContain("kunci-uji");
  });

  it("membaca `reasoning` ketika `content` kembali null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion({ content: null, reasoning: '{"score":80,"verdict":"MATCH"}' })));

    const result = await getAiClient().complete("tanya");

    expect(result).toEqual({ ok: true, text: '{"score":80,"verdict":"MATCH"}', model: "model-uji" });
  });

  it("mendahulukan `content` ketika keduanya terisi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion({ content: "jawaban", reasoning: "uraian pikiran" })));

    const result = await getAiClient().complete("tanya");

    expect(result).toMatchObject({ ok: true, text: "jawaban" });
  });

  it("menyebut BAD_RESPONSE bila kedua medannya kosong", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion({ content: null, reasoning: "   " })));

    expect(await getAiClient().complete("tanya")).toEqual({ ok: false, code: "BAD_RESPONSE" });
  });

  it("memetakan status HTTP ke sebab yang dapat ditindaklanjuti", async () => {
    const cases: Array<[number, string, string]> = [
      [402, "", "NO_FUNDS"],
      [403, "free tier only usable from within OpenCode", "FREE_TIER_BLOCKED"],
      [403, "forbidden", "UNAUTHORIZED"],
      [401, "", "UNAUTHORIZED"],
      [429, "", "RATE_LIMITED"],
      [500, "boom", "REQUEST_FAILED"],
      [400, "Insufficient account funds", "NO_FUNDS"],
    ];
    for (const [status, detail, code] of cases) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(detail, { status })));
      expect(await getAiClient().complete("tanya")).toEqual({ ok: false, code });
    }
  });

  it("menyebut TIMEOUT terpisah dari kegagalan jaringan lain", async () => {
    const timeout = Object.assign(new Error("habis waktu"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    expect(await getAiClient().complete("tanya")).toEqual({ ok: false, code: "TIMEOUT" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await getAiClient().complete("tanya")).toEqual({ ok: false, code: "REQUEST_FAILED" });
  });

  it("tidak memanggil apa pun ketika key atau host belum diisi", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const missing of ["AI_API_KEY", "AI_BASE_URL"] as const) {
      process.env.AI_API_KEY = "kunci-uji";
      process.env.AI_BASE_URL = "http://penyedia.uji/v1";
      process.env[missing] = "";

      const client = getAiClient();
      expect(client.configured).toBe(false);
      expect(await client.complete("tanya")).toEqual({ ok: false, code: "UNCONFIGURED" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
