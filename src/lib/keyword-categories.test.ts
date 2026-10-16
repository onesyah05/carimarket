import { describe, expect, it } from "vitest";
import { CATEGORY_KEYWORDS, OPEN_CATEGORY, categorySuggestions, checkKeywordCategory } from "./keyword-categories";

describe("categorySuggestions", () => {
  it("memberi saran untuk kategori yang dikenal", () => {
    expect(categorySuggestions("Jasa Drone")).toContain("jasa drone");
  });

  it("mengembalikan daftar kosong untuk kategori yang tidak dikenal", () => {
    expect(categorySuggestions("Kategori Karangan")).toEqual([]);
  });

  it("setiap sarannya sendiri lolos pemeriksaan kategorinya", () => {
    // Saran yang kami tawarkan tidak boleh ditolak oleh aturan kami sendiri.
    for (const [category, entry] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const suggestion of entry.suggestions) {
        expect(checkKeywordCategory(suggestion, category), `${category}: ${suggestion}`).toEqual({ ok: true });
      }
    }
  });
});

describe("checkKeywordCategory", () => {
  it("menerima kata kunci yang memuat penanda kategorinya", () => {
    expect(checkKeywordCategory("butuh jasa drone murah", "Jasa Drone").ok).toBe(true);
  });

  it("menolak kata kunci milik bidang lain", () => {
    const verdict = checkKeywordCategory("jasa drone", "Properti");
    expect(verdict.ok).toBe(false);
    expect(verdict.ok || verdict.conflictCategory).toBe("Jasa Drone");
  });

  it("menyebut kedua kategori dalam pesannya", () => {
    const verdict = checkKeywordCategory("cari catering", "Teknologi");
    expect(verdict.ok || verdict.message).toContain("Kuliner");
    expect(verdict.ok || verdict.message).toContain("Teknologi");
  });

  it("membiarkan frasa umum tanpa penanda apa pun", () => {
    for (const phrase of ["butuh bantuan", "rekomendasi dong", "area jakarta selatan"]) {
      expect(checkKeywordCategory(phrase, "Properti"), phrase).toEqual({ ok: true });
    }
  });

  it("menerima frasa yang memuat penanda kedua kategori", () => {
    // "foto udara rumah" relevan untuk Jasa Drone meski menyebut rumah.
    expect(checkKeywordCategory("foto udara rumah", "Jasa Drone").ok).toBe(true);
  });

  it("tidak membatasi kategori terbuka", () => {
    expect(checkKeywordCategory("jasa drone", OPEN_CATEGORY)).toEqual({ ok: true });
  });

  it("tidak membatasi akun yang kategorinya belum diisi", () => {
    expect(checkKeywordCategory("jasa drone", "")).toEqual({ ok: true });
  });

  it("tidak terpancing oleh potongan kata", () => {
    // "rumahan" bukan "rumah"; penanda dicocokkan sebagai kata utuh.
    expect(checkKeywordCategory("usaha rumahan", "Teknologi")).toEqual({ ok: true });
  });

  it("mengabaikan beda huruf besar dan tanda baca", () => {
    expect(checkKeywordCategory("Cari KLINIK, gigi!", "Teknologi").ok).toBe(false);
  });
});
