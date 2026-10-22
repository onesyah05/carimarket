import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { enforceRateLimit, enforceSameOrigin, rateLimitSize, resetRateLimits } from "./request-guards";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

const appUrl = "https://app.carimarket.test";

function request(origin?: string, extra?: Record<string, string>) {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  for (const [name, value] of Object.entries(extra ?? {})) headers.set(name, value);
  return new Request(`${appUrl}/api/keywords`, { method: "POST", headers });
}

describe("enforceRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("mengizinkan permintaan sampai batas lalu menolak", () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(() => enforceRateLimit("kunci", 3, 60_000)).not.toThrow();
    }
    expect(() => enforceRateLimit("kunci", 3, 60_000)).toThrowError(ThreadsIntegrationError);
  });

  it("menghitung tiap kunci secara terpisah", () => {
    enforceRateLimit("a", 1, 60_000);
    expect(() => enforceRateLimit("b", 1, 60_000)).not.toThrow();
    expect(() => enforceRateLimit("a", 1, 60_000)).toThrow();
  });

  it("membuka kembali setelah jendela berakhir", () => {
    enforceRateLimit("kunci", 1, 1);
    const resumeAt = Date.now() + 5;
    while (Date.now() < resumeAt) { /* tunggu jendela 1 ms berakhir */ }
    expect(() => enforceRateLimit("kunci", 1, 1)).not.toThrow();
  });

  it("membersihkan entri kedaluwarsa sehingga map tidak tumbuh tanpa batas", () => {
    for (let index = 0; index < 50; index += 1) enforceRateLimit(`kunci-${index}`, 5, 1);
    expect(rateLimitSize()).toBe(50);
    const resumeAt = Date.now() + 5;
    while (Date.now() < resumeAt) { /* biarkan seluruh jendela berakhir */ }
    // Pemicu pembersihan berjalan pada permintaan berikutnya.
    resetRateLimits();
    enforceRateLimit("kunci-baru", 5, 60_000);
    expect(rateLimitSize()).toBe(1);
  });

  it("menolak dengan kode dan status yang dapat ditampilkan ke pengguna", () => {
    enforceRateLimit("kunci", 1, 60_000);
    try {
      enforceRateLimit("kunci", 1, 60_000);
      throw new Error("seharusnya menolak");
    } catch (error) {
      expect(error).toBeInstanceOf(ThreadsIntegrationError);
      expect((error as ThreadsIntegrationError).code).toBe("RATE_LIMITED");
      expect((error as ThreadsIntegrationError).status).toBe(429);
    }
  });
});

describe("enforceSameOrigin", () => {
  const originalUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalEnv = process.env.NODE_ENV;

  function setEnv(value: string | undefined) {
    // NODE_ENV hanya dapat ditulis lewat jalur ini karena tipenya dipersempit.
    (process.env as Record<string, string | undefined>).NODE_ENV = value;
  }

  beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = appUrl; });
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalUrl;
    setEnv(originalEnv);
  });

  function codeOf(call: () => void) {
    try {
      call();
      return null;
    } catch (error) {
      expect(error).toBeInstanceOf(ThreadsIntegrationError);
      return (error as ThreadsIntegrationError).code;
    }
  }

  it("menerima permintaan dari origin aplikasi", () => {
    expect(() => enforceSameOrigin(request(appUrl))).not.toThrow();
  });

  it("menolak origin lain", () => {
    expect(codeOf(() => enforceSameOrigin(request("https://penyerang.test")))).toBe("ORIGIN_REJECTED");
  });

  it("menolak origin buram yang dikirim sebagai null", () => {
    setEnv("production");
    expect(codeOf(() => enforceSameOrigin(request("null")))).toBe("ORIGIN_UNVERIFIABLE");
  });

  it("menerima permintaan tanpa origin bila Sec-Fetch-Site menyatakan same-origin", () => {
    setEnv("production");
    expect(() => enforceSameOrigin(request(undefined, { "sec-fetch-site": "same-origin" }))).not.toThrow();
  });

  it("menolak permintaan tanpa origin yang Sec-Fetch-Site-nya lintas situs", () => {
    setEnv("production");
    expect(codeOf(() => enforceSameOrigin(request(undefined, { "sec-fetch-site": "cross-site" })))).toBe("ORIGIN_REJECTED");
  });

  it("melewati pemeriksaan tanpa petunjuk apa pun hanya di luar produksi", () => {
    setEnv("development");
    expect(() => enforceSameOrigin(request())).not.toThrow();
    setEnv("production");
    expect(codeOf(() => enforceSameOrigin(request()))).toBe("ORIGIN_UNVERIFIABLE");
  });

  it("gagal tertutup di produksi bila alamat aplikasi belum dikonfigurasi", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    setEnv("development");
    expect(() => enforceSameOrigin(request(appUrl))).not.toThrow();
    setEnv("production");
    expect(codeOf(() => enforceSameOrigin(request(appUrl)))).toBe("ORIGIN_UNVERIFIABLE");
  });
});
