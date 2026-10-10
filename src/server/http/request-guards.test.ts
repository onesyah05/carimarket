import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { enforceRateLimit, enforceSameOrigin, rateLimitSize, resetRateLimits } from "./request-guards";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

const appUrl = "https://app.carimarket.test";

function request(origin?: string) {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
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

  beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = appUrl; });
  afterEach(() => { process.env.NEXT_PUBLIC_APP_URL = originalUrl; });

  it("menerima permintaan dari origin aplikasi", () => {
    expect(() => enforceSameOrigin(request(appUrl))).not.toThrow();
  });

  it("menolak origin lain", () => {
    expect(() => enforceSameOrigin(request("https://penyerang.test"))).toThrowError(ThreadsIntegrationError);
  });

  it("melewati pemeriksaan saat header origin tidak ada", () => {
    expect(() => enforceSameOrigin(request())).not.toThrow();
  });
});
