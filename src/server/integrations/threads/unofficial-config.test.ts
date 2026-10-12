import { describe, expect, it } from "vitest";
import {
  computeJazoest,
  extractSessionTokens,
  parseUnofficialCredentials,
  readCookieValue,
} from "./unofficial-config";

const FULL_COOKIE =
  "ig_did=96440DC8-3B65-448A-B140-9D4496B45F65; mid=ai_k8QALAAErGcFNCCCfkqbOcfgz; csrftoken=v77IPMvsFMR9i7xZMzOqWMJToue1wDSQ; ds_user_id=63079633726; sessionid=63079633726%3A5MqsRFJNGy5Vz5%3A19%3AAYmQ";

describe("readCookieValue", () => {
  it("membaca nilai meski bukan pasangan pertama", () => {
    expect(readCookieValue(FULL_COOKIE, "ds_user_id")).toBe("63079633726");
  });

  it("tidak tertukar dengan kunci yang namanya berakhiran sama", () => {
    expect(readCookieValue("x_csrftoken=salah; csrftoken=benar", "csrftoken")).toBe("benar");
  });

  it("mengembalikan kosong bila kunci tidak ada", () => {
    expect(readCookieValue(FULL_COOKIE, "fb_dtsg")).toBe("");
  });
});

describe("parseUnofficialCredentials", () => {
  it("menerima cookie lengkap dan mengambil csrftoken dari dalamnya", () => {
    const parsed = parseUnofficialCredentials(` ${FULL_COOKIE} `);
    expect(parsed).not.toBeNull();
    expect(parsed?.cookie).toBe(FULL_COOKIE);
    expect(parsed?.csrf).toBe("v77IPMvsFMR9i7xZMzOqWMJToue1wDSQ");
  });

  it("menolak cookie tanpa sessionid", () => {
    expect(parseUnofficialCredentials("csrftoken=a; ds_user_id=1")).toBeNull();
  });

  it("menolak cookie yang kuncinya ada tapi nilainya kosong", () => {
    expect(parseUnofficialCredentials("sessionid=; csrftoken=a; ds_user_id=1")).toBeNull();
  });

  it("menolak string kosong", () => {
    expect(parseUnofficialCredentials("   ")).toBeNull();
  });
});

describe("computeJazoest", () => {
  it("mengikuti rumus Meta: 2 + jumlah charcode modulo 100000", () => {
    expect(computeJazoest("NAfteWQ123")).toBe("2780");
  });
});

describe("extractSessionTokens", () => {
  const html = `<script>requireLazy(["x"],function(){ ["DTSGInitialData",[],{"token":"NAfteWQ123"},258]; ["LSD",[],{"token":"KBSzAYNLbg-aESJzrrdG06"},323]; })</script>`;

  it("mengambil fb_dtsg, lsd, dan jazoest turunannya", () => {
    expect(extractSessionTokens(html)).toEqual({
      fbDtsg: "NAfteWQ123",
      lsd: "KBSzAYNLbg-aESJzrrdG06",
      jazoest: "2780",
    });
  });

  it("mengembalikan null untuk halaman logged-out", () => {
    expect(extractSessionTokens("<html><body>Masuk ke Threads</body></html>")).toBeNull();
  });

  it("mengembalikan null bila hanya salah satu token yang ada", () => {
    expect(extractSessionTokens(`["DTSGInitialData",[],{"token":"NAfteWQ123"},258]`)).toBeNull();
  });
});
