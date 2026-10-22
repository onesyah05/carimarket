import { describe, expect, it } from "vitest";
import { parseStaticBody, staticPageSchema } from "./static-pages";

describe("parseStaticBody", () => {
  it("memisahkan paragraf pada baris kosong", () => {
    expect(parseStaticBody("Satu.\n\nDua.")).toEqual([
      { kind: "paragraph", text: "Satu." },
      { kind: "paragraph", text: "Dua." },
    ]);
  });

  it("mengenali subjudul dari awalan dua tanda pagar", () => {
    const blocks = parseStaticBody("## Misi kami\n\nIsi misinya.");
    expect(blocks).toEqual([
      { kind: "heading", text: "Misi kami" },
      { kind: "paragraph", text: "Isi misinya." },
    ]);
  });

  it("menyatukan baris tunggal di dalam satu paragraf", () => {
    // Editor sering menekan Enter sekali untuk membungkus baris; itu bukan
    // paragraf baru.
    expect(parseStaticBody("Kalimat pertama\nmasih satu paragraf.")).toEqual([
      { kind: "paragraph", text: "Kalimat pertama masih satu paragraf." },
    ]);
  });

  it("membuang blok kosong dan spasi berlebih", () => {
    expect(parseStaticBody("\n\n  Satu.  \n\n\n\n   \n\nDua.\n\n")).toEqual([
      { kind: "paragraph", text: "Satu." },
      { kind: "paragraph", text: "Dua." },
    ]);
  });

  it("tidak memperlakukan satu tanda pagar sebagai subjudul", () => {
    expect(parseStaticBody("# Bukan subjudul")).toEqual([
      { kind: "paragraph", text: "# Bukan subjudul" },
    ]);
  });
});

describe("staticPageSchema", () => {
  const valid = { slug: "tentang", title: "Tentang Kami", body: "Isi halaman yang cukup panjang untuk lolos." };

  it("menerima halaman yang dikenali", () => {
    expect(staticPageSchema.safeParse(valid).success).toBe(true);
  });

  it("menolak slug di luar daftar tertutup", () => {
    expect(staticPageSchema.safeParse({ ...valid, slug: "beranda" }).success).toBe(false);
  });

  it("menolak isi yang terlalu pendek untuk menjadi halaman", () => {
    expect(staticPageSchema.safeParse({ ...valid, body: "Terlalu pendek" }).success).toBe(false);
  });
});
