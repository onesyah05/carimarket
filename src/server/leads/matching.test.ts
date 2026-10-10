import { describe, expect, it } from "vitest";
import { matchedExcludedTerm, normalizeTerm, relevanceScore } from "./matching";

describe("relevanceScore", () => {
  it("memberi skor penuh saat seluruh kata kunci muncul", () => {
    expect(relevanceScore("Butuh jasa drone untuk dokumentasi", "jasa drone")).toBe(100);
  });

  it("menurunkan skor saat hanya sebagian kata kunci muncul", () => {
    expect(relevanceScore("Butuh jasa fotografi", "jasa drone")).toBe(85);
  });

  it("tidak pernah di bawah dasar 70 maupun di atas 100", () => {
    expect(relevanceScore("tidak relevan", "jasa drone")).toBe(70);
    expect(relevanceScore("jasa drone jasa drone", "jasa drone")).toBe(100);
  });

  it("mengabaikan beda huruf besar kecil", () => {
    expect(relevanceScore("JASA DRONE di BSD", "jasa drone")).toBe(100);
  });
});

describe("matchedExcludedTerm", () => {
  it("mengembalikan null saat tidak ada kata kunci negatif", () => {
    expect(matchedExcludedTerm("Cari jasa drone di BSD", [])).toBeNull();
  });

  it("menandai postingan yang memuat kata kunci negatif", () => {
    expect(matchedExcludedTerm("Ada lowongan operator drone?", ["lowongan"])).toBe("lowongan");
  });

  it("mencocokkan frasa multi-kata", () => {
    expect(matchedExcludedTerm("Butuh jasa drone gratis ya", ["jasa drone gratis"])).toBe("jasa drone gratis");
  });

  it("tidak menandai kata yang hanya kebetulan menjadi bagian kata lain", () => {
    expect(matchedExcludedTerm("Promo gratisan bulan ini", ["gratis"])).toBeNull();
  });

  it("tetap mencocokkan saat kata diapit tanda baca", () => {
    expect(matchedExcludedTerm("Dicari: (lowongan) baru", ["lowongan"])).toBe("lowongan");
  });

  it("mengabaikan beda huruf dan spasi berlebih pada kata kunci", () => {
    expect(matchedExcludedTerm("Butuh LOWONGAN segera", ["  lowongan "])).toBe("lowongan");
  });

  it("melewati kata kunci kosong", () => {
    expect(matchedExcludedTerm("jasa drone", ["", "   "])).toBeNull();
  });
});

describe("normalizeTerm", () => {
  it("memangkas spasi dan menurunkan huruf", () => {
    expect(normalizeTerm("  Jasa Drone  ")).toBe("jasa drone");
  });
});
