import { describe, expect, it } from "vitest";
import { API_KEY_PREFIX, generateApiKey, hashApiKey, readBearerKey } from "./credentials";

describe("generateApiKey", () => {
  it("memakai format cmk_<prefix>_<rahasia>", () => {
    const { key, keyPrefix } = generateApiKey();
    expect(key.startsWith(`${keyPrefix}_`)).toBe(true);
    expect(keyPrefix.startsWith(`${API_KEY_PREFIX}_`)).toBe(true);
    expect(key.split("_")).toHaveLength(3);
  });

  it("memakai heksadesimal sehingga tidak ada pemisah yang ambigu", () => {
    const { key } = generateApiKey();
    expect(key).toMatch(/^cmk_[0-9a-f]{8}_[0-9a-f]{64}$/);
  });

  it("menghasilkan rahasia yang cukup panjang", () => {
    const secret = generateApiKey().key.split("_")[2];
    expect(secret.length).toBeGreaterThanOrEqual(40);
  });

  it("tidak pernah mengulang kunci", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey().key));
    expect(keys.size).toBe(50);
  });
});

describe("hashApiKey", () => {
  it("stabil dan tidak memuat nilai aslinya", () => {
    const { key } = generateApiKey();
    const hash = hashApiKey(key);
    expect(hash).toBe(hashApiKey(key));
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(key.split("_")[2]);
  });

  it("berbeda untuk kunci berbeda", () => {
    expect(hashApiKey(generateApiKey().key)).not.toBe(hashApiKey(generateApiKey().key));
  });
});

describe("readBearerKey", () => {
  it("membaca kunci dari header Bearer", () => {
    expect(readBearerKey("Bearer cmk_1a2b3c4d_rahasia")).toBe("cmk_1a2b3c4d_rahasia");
    expect(readBearerKey("bearer cmk_1a2b3c4d_rahasia")).toBe("cmk_1a2b3c4d_rahasia");
    expect(readBearerKey("  Bearer   cmk_1a2b3c4d_rahasia  ")).toBe("cmk_1a2b3c4d_rahasia");
  });

  it("menolak header yang tidak sesuai", () => {
    expect(readBearerKey(null)).toBeNull();
    expect(readBearerKey("")).toBeNull();
    expect(readBearerKey("cmk_1a2b3c4d_rahasia")).toBeNull();
    expect(readBearerKey("Basic cmk_1a2b3c4d_rahasia")).toBeNull();
    expect(readBearerKey("Bearer ")).toBeNull();
  });

  it("menolak token yang bukan kunci Cari Market", () => {
    expect(readBearerKey("Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature")).toBeNull();
    expect(readBearerKey("Bearer sk_live_abcdef")).toBeNull();
  });
});
