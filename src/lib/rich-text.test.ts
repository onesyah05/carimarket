import { describe, expect, it } from "vitest";
import { parseInline, parseRichText, richTextToPlain } from "./rich-text";

describe("parseInline", () => {
  it("membaca tebal, miring, dan kode", () => {
    expect(parseInline("ada **tebal** dan *miring* dan `kode`")).toEqual([
      { kind: "text", value: "ada " },
      { kind: "bold", value: "tebal" },
      { kind: "text", value: " dan " },
      { kind: "italic", value: "miring" },
      { kind: "text", value: " dan " },
      { kind: "code", value: "kode" },
    ]);
  });

  it("tidak membaca penanda di dalam kode sebagai format", () => {
    expect(parseInline("`**bukan tebal**`")).toEqual([{ kind: "code", value: "**bukan tebal**" }]);
  });

  it("menjadikan URL http(s) sebagai tautan", () => {
    const parsed = parseInline("lihat https://carimarket.id/dashboard ya");
    expect(parsed).toContainEqual({ kind: "link", value: "https://carimarket.id/dashboard", href: "https://carimarket.id/dashboard" });
  });
});

describe("keamanan", () => {
  it("tidak pernah menghasilkan potongan selain teks untuk markup mentah", () => {
    const parsed = parseInline('<script>alert(1)</script><img src=x onerror=alert(1)>');
    // Semuanya harus tetap teks: penampil merakit elemen React, jadi teks ini
    // akan muncul apa adanya di layar, bukan dieksekusi.
    expect(parsed.every(inline => inline.kind === "text")).toBe(true);
  });

  it("tidak membuat tautan dari skema berbahaya", () => {
    for (const hostile of ["javascript:alert(1)", "data:text/html;base64,PHN2Zz4=", "vbscript:msgbox(1)"]) {
      const parsed = parseInline(hostile);
      expect(parsed.some(inline => inline.kind === "link")).toBe(false);
    }
  });
});

describe("parseRichText", () => {
  it("memisahkan paragraf pada baris kosong", () => {
    const blocks = parseRichText("baris satu\nmasih satu\n\nparagraf dua");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ kind: "paragraph", inlines: [{ kind: "text", value: "baris satu masih satu" }] });
  });

  it("membaca daftar berbutir dan bernomor sebagai blok terpisah", () => {
    const blocks = parseRichText("- satu\n- dua\n\n1. pertama\n2. kedua");
    expect(blocks.map(block => block.kind)).toEqual(["list", "list"]);
    expect(blocks[0]).toMatchObject({ ordered: false });
    expect(blocks[1]).toMatchObject({ ordered: true });
  });

  it("memutus daftar ketika jenisnya berganti tanpa baris kosong", () => {
    const blocks = parseRichText("- satu\n1. dua");
    expect(blocks).toHaveLength(2);
  });

  it("mengabaikan masukan kosong", () => {
    expect(parseRichText("")).toEqual([]);
    expect(parseRichText("\n\n   \n")).toEqual([]);
  });

  it("menerima akhir baris Windows", () => {
    expect(parseRichText("satu\r\n\r\ndua")).toHaveLength(2);
  });
});

describe("richTextToPlain", () => {
  it("membuang penanda dan merapatkan spasi", () => {
    expect(richTextToPlain("**Halo**\n\n- *satu*\n- `dua`")).toBe("Halo satu dua");
  });

  it("menghasilkan string kosong untuk isi kosong", () => {
    expect(richTextToPlain("   ")).toBe("");
  });
});
