import { describe, expect, it } from "vitest";
import { describeMetaError, isTransientMetaFailure, metaErrorCode, parseMetaError, redactSecrets } from "./meta-errors";

describe("parseMetaError", () => {
  it("membaca seluruh field error Meta", () => {
    const diagnostics = parseMetaError({
      error: { message: "Invalid parameter", code: 100, error_subcode: 33, type: "OAuthException", fbtrace_id: "Abc123" },
    }, 400);
    expect(diagnostics).toEqual({
      httpStatus: 400,
      code: 100,
      subcode: 33,
      type: "OAuthException",
      message: "Invalid parameter",
      traceId: "Abc123",
    });
  });

  it("menerima payload kosong tanpa melempar", () => {
    const diagnostics = parseMetaError(null, 502);
    expect(diagnostics.code).toBeNull();
    expect(diagnostics.subcode).toBeNull();
    expect(diagnostics.message).toBe("tanpa pesan dari Meta");
  });

  it("menerima kode berbentuk string", () => {
    expect(parseMetaError({ error: { code: "190" } }, 400).code).toBe(190);
  });
});

describe("redactSecrets", () => {
  it("menyensor token aplikasi Threads", () => {
    expect(redactSecrets("token TH|123456789|ckHuFA7hDkAyoOERGUNsYTTdQBg habis")).toBe("token <disensor> habis");
  });

  it("menyensor parameter rahasia pada URL", () => {
    const safe = redactSecrets("GET /access_token?grant_type=th_exchange_token&client_secret=abcdef123456&access_token=xyz987654");
    expect(safe).not.toContain("abcdef123456");
    expect(safe).not.toContain("xyz987654");
  });

  it("menyensor string panjang yang menyerupai token", () => {
    const secret = "a".repeat(45);
    expect(redactSecrets(`nilai ${secret}`)).toBe("nilai <disensor>");
  });

  it("membiarkan pesan biasa apa adanya", () => {
    expect(redactSecrets("Invalid parameter")).toBe("Invalid parameter");
  });
});

describe("isTransientMetaFailure", () => {
  const base = { code: null, subcode: null, type: null, message: "", traceId: null };

  it("menganggap error server dan rate limit sebagai sementara", () => {
    expect(isTransientMetaFailure({ ...base, httpStatus: 500 })).toBe(true);
    expect(isTransientMetaFailure({ ...base, httpStatus: 503 })).toBe(true);
    expect(isTransientMetaFailure({ ...base, httpStatus: 429 })).toBe(true);
  });

  it("menganggap kode tak terduga Meta sebagai sementara", () => {
    for (const code of [0, 1, 2, 4, 17, 341, 368]) {
      expect(isTransientMetaFailure({ ...base, httpStatus: 400, code })).toBe(true);
    }
  });

  it("tidak mencoba ulang error parameter dan izin", () => {
    expect(isTransientMetaFailure({ ...base, httpStatus: 400, code: 100, message: "Invalid parameter" })).toBe(false);
    expect(isTransientMetaFailure({ ...base, httpStatus: 400, code: 190, message: "Invalid OAuth access token" })).toBe(false);
    expect(isTransientMetaFailure({ ...base, httpStatus: 403, code: 200, message: "Permissions error" })).toBe(false);
  });

  it("mengenali pesan yang menyebut coba lagi", () => {
    expect(isTransientMetaFailure({ ...base, httpStatus: 400, code: 100, message: "Please retry your request later" })).toBe(true);
  });
});

describe("metaErrorCode", () => {
  const base = { httpStatus: 400, subcode: null, type: null, message: "", traceId: null };

  it("memakai kode Meta bila tersedia", () => {
    expect(metaErrorCode({ ...base, code: 100 })).toBe("META_100");
  });

  it("menyertakan subcode bila ada", () => {
    expect(metaErrorCode({ ...base, code: 100, subcode: 33 })).toBe("META_100_33");
  });

  it("jatuh ke status HTTP bila Meta tidak memberi kode", () => {
    expect(metaErrorCode({ ...base, httpStatus: 502, code: null })).toBe("HTTP_502");
  });
});

describe("describeMetaError", () => {
  it("merangkum satu baris untuk log server", () => {
    const line = describeMetaError(parseMetaError({
      error: { message: "Invalid parameter", code: 100, error_subcode: 33, type: "OAuthException", fbtrace_id: "Abc" },
    }, 400));
    expect(line).toBe('http=400 code=100 subcode=33 type=OAuthException trace=Abc message="Invalid parameter"');
  });
});
