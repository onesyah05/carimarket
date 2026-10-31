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
  // Cadangan dimatikan secara bawaan; pengujian yang memerlukannya memasang
  // sendiri, supaya pengujian lain benar-benar menguji penyedia utama saja.
  process.env.AI_FALLBACK_API_KEY = "";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllGlobals();
});

describe("aiConfig", () => {
  it("membuang garis miring di ujung agar jalurnya tidak berganda", () => {
    process.env.AI_BASE_URL = "http://penyedia.uji/v1///";
    expect(aiConfig().primary.baseUrl).toBe("http://penyedia.uji/v1");
  });

  it("memberi cadangan alamat bawaan, jadi memasangnya cukup dengan satu kunci", () => {
    process.env.AI_FALLBACK_API_KEY = "kunci-cadangan";
    delete process.env.AI_FALLBACK_BASE_URL;
    delete process.env.AI_FALLBACK_MODEL;
    expect(aiConfig().fallback).toEqual({
      apiKeys: ["kunci-cadangan"],
      baseUrl: "https://opencode.ai/zen/v1",
      model: "claude-haiku-5-5",
    });
  });

  it("memecah beberapa kunci yang dipisah koma", () => {
    process.env.AI_API_KEY = " kunci-satu , kunci-dua ,, ";
    // Spasi dan koma menggantung dirapikan: nilai env sering disunting tangan
    // langsung di server, dan satu koma tertinggal tidak boleh menjadi kunci
    // kosong yang ikut dicoba.
    expect(aiConfig().primary.apiKeys).toEqual(["kunci-satu", "kunci-dua"]);
  });

  it("menganggap kunci kosong sebagai belum disetel", () => {
    process.env.AI_API_KEY = "  ,  ";
    expect(aiConfig().primary.apiKeys).toEqual([]);
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

/**
 * Perilaku cadangan.
 *
 * Yang dikunci bukan sekadar "cadangan dipakai", melainkan kapan ia TIDAK
 * dipakai dan kode apa yang dilaporkan saat ia ikut gagal — keduanya
 * menentukan apakah satu 429 sekejap mematikan penilaian seluruh pencarian.
 */
describe("cadangan saat penyedia utama membatasi laju", () => {
  const rateLimited = () => new Response("slow down", { status: 429 });

  function twoProviders(second: () => Response | Promise<Response>) {
    process.env.AI_FALLBACK_API_KEY = "kunci-cadangan";
    process.env.AI_FALLBACK_BASE_URL = "https://cadangan.uji/v1";
    process.env.AI_FALLBACK_MODEL = "model-cadangan";
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => rateLimited())
      .mockImplementationOnce(async () => second());
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("mengulang ke penyedia cadangan dan memakai jawabannya", async () => {
    const fetchMock = twoProviders(() => jsonResponse({ choices: [{ message: { content: "dari cadangan" } }] }));

    const result = await getAiClient().complete("tanya");

    expect(result).toEqual({ ok: true, text: "dari cadangan", model: "model-cadangan" });
    expect(fetchMock.mock.calls[0][0]).toBe("http://penyedia.uji/v1/chat/completions");
    expect(fetchMock.mock.calls[1][0]).toBe("https://cadangan.uji/v1/chat/completions");
  });

  it("mengirim kunci cadangan ke penyedia cadangan, bukan kunci utama", async () => {
    const fetchMock = twoProviders(() => jsonResponse({ choices: [{ message: { content: "dari cadangan" } }] }));

    await getAiClient().complete("tanya");

    const headers = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer kunci-cadangan");
  });

  it("melaporkan 429 milik penyedia utama ketika cadangan ikut gagal", async () => {
    // Bukan NO_FUNDS milik cadangan: kode itu dianggap kegagalan tingkat akun
    // dan akan menghentikan penilaian seluruh sisa postingan, padahal yang
    // sebenarnya terjadi di penyedia utama hanya pembatasan laju sementara.
    twoProviders(() => new Response("Insufficient account funds", { status: 402 }));

    expect(await getAiClient().complete("tanya")).toEqual({ ok: false, code: "RATE_LIMITED" });
  });

  it("tidak menyentuh cadangan untuk sebab kegagalan selain 429", async () => {
    process.env.AI_FALLBACK_API_KEY = "kunci-cadangan";
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await getAiClient().complete("tanya")).toEqual({ ok: false, code: "UNAUTHORIZED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tidak menyentuh cadangan ketika penyedia utama menjawab", async () => {
    process.env.AI_FALLBACK_API_KEY = "kunci-cadangan";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "halo" } }] }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await getAiClient().complete("tanya")).toMatchObject({ ok: true, text: "halo" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("memakai cadangan sepenuhnya ketika penyedia utama belum disetel", async () => {
    process.env.AI_API_KEY = "";
    process.env.AI_FALLBACK_API_KEY = "kunci-cadangan";
    process.env.AI_FALLBACK_BASE_URL = "https://cadangan.uji/v1";
    process.env.AI_FALLBACK_MODEL = "model-cadangan";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "halo" } }] }));
    vi.stubGlobal("fetch", fetchMock);

    const client = getAiClient();
    expect(client.configured).toBe(true);
    expect(await client.complete("tanya")).toMatchObject({ ok: true, model: "model-cadangan" });
  });

  it("tetap UNCONFIGURED bila keduanya kosong", async () => {
    process.env.AI_API_KEY = "";
    process.env.AI_FALLBACK_API_KEY = "";
    const client = getAiClient();
    expect(client.configured).toBe(false);
    expect(await client.complete("tanya")).toEqual({ ok: false, code: "UNCONFIGURED" });
  });
});

/**
 * Pergantian kunci.
 *
 * Saldo OpenCode melekat pada akun, jadi satu akun habis berarti seluruh
 * modelnya menolak. Yang diuji di sini: kapan kunci berikutnya dipakai, dan
 * yang lebih penting, kapan TIDAK, supaya kuota akun kedua tidak ikut terbakar
 * untuk persoalan yang bukan soal kunci.
 */
describe("beberapa kunci pada satu penyedia", () => {
  function keyedFetch(byKey: Record<string, () => Response>) {
    const used: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const auth = String((init.headers as Record<string, string>).authorization);
      const key = auth.replace("Bearer ", "");
      used.push(key);
      return byKey[key]();
    });
    vi.stubGlobal("fetch", fetchMock);
    return { used };
  }

  const funds = () => new Response(JSON.stringify({ error: { message: "Insufficient account funds" } }), { status: 402 });
  const okReply = () => jsonResponse({ choices: [{ message: { content: "halo" } }] });

  beforeEach(() => {
    process.env.AI_API_KEY = "habis,bersaldo";
    process.env.AI_BASE_URL = "https://opencode.uji/v1";
  });

  it("pindah ke kunci berikutnya ketika saldo habis", async () => {
    const { used } = keyedFetch({ habis: funds, bersaldo: okReply });

    const result = await getAiClient().complete("tanya");

    expect(result).toMatchObject({ ok: true, text: "halo" });
    expect(used).toEqual(["habis", "bersaldo"]);
  });

  it("berhenti di kunci pertama yang berhasil", async () => {
    process.env.AI_API_KEY = "bersaldo,cadangan";
    const { used } = keyedFetch({ bersaldo: okReply, cadangan: okReply });

    await getAiClient().complete("tanya");

    expect(used).toEqual(["bersaldo"]);
  });

  it("pindah kunci juga saat kena pembatasan laju", async () => {
    // Kuota laju pun melekat pada akun, jadi akun lain adalah jalan keluarnya.
    const { used } = keyedFetch({
      habis: () => new Response("slow down", { status: 429 }),
      bersaldo: okReply,
    });

    await getAiClient().complete("tanya");

    expect(used).toEqual(["habis", "bersaldo"]);
  });

  it("tidak membakar kunci kedua untuk kegagalan yang bukan soal kunci", async () => {
    // Timeout dan jawaban tak terbaca akan terulang sama persis di akun lain.
    for (const failing of [
      () => new Response("boom", { status: 500 }),
      () => jsonResponse({ choices: [{ message: { content: null } }] }),
    ]) {
      const { used } = keyedFetch({ habis: failing, bersaldo: okReply });
      await getAiClient().complete("tanya");
      expect(used).toEqual(["habis"]);
    }
  });

  it("melaporkan kegagalan kunci terakhir ketika semuanya habis", async () => {
    const { used } = keyedFetch({ habis: funds, bersaldo: funds });

    expect(await getAiClient().complete("tanya")).toEqual({ ok: false, code: "NO_FUNDS" });
    expect(used).toEqual(["habis", "bersaldo"]);
  });
});
