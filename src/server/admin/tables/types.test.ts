import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, buildPage, normalizeQuery, skipFor } from "./types";

describe("normalizeQuery", () => {
  it("memakai bawaan untuk masukan kosong", () => {
    expect(normalizeQuery({})).toEqual({ q: "", page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it("menolak ukuran halaman di luar pilihan yang disediakan", () => {
    // Nilai bebas dari klien akan menjadi beban kueri; hanya pilihan yang
    // tampil di antarmuka yang diterima.
    expect(normalizeQuery({ pageSize: 5000 }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizeQuery({ pageSize: 7 }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizeQuery({ pageSize: 50 }).pageSize).toBe(50);
  });

  it("mengoreksi nomor halaman yang tidak masuk akal", () => {
    expect(normalizeQuery({ page: 0 }).page).toBe(1);
    expect(normalizeQuery({ page: -4 }).page).toBe(1);
    expect(normalizeQuery({ page: Number.NaN }).page).toBe(1);
    expect(normalizeQuery({ page: 3.8 }).page).toBe(3);
  });

  it("memangkas kata pencarian yang kepanjangan", () => {
    const long = "a".repeat(400);
    expect(normalizeQuery({ q: `  ${long}  ` }).q).toHaveLength(120);
  });
});

describe("skipFor", () => {
  it("menghitung lompatan baris dari halaman", () => {
    expect(skipFor({ q: "", page: 1, pageSize: 20 }, 100)).toBe(0);
    expect(skipFor({ q: "", page: 3, pageSize: 20 }, 100)).toBe(40);
  });

  it("tidak pernah melompati seluruh hasil ketika halaman melewati batas", () => {
    // Mengetik pencarian memangkas jumlah halaman; tanpa penjepitan ini
    // pengguna melihat tabel kosong padahal hasilnya ada di halaman pertama.
    expect(skipFor({ q: "", page: 99, pageSize: 20 }, 25)).toBe(20);
    expect(skipFor({ q: "", page: 99, pageSize: 20 }, 3)).toBe(0);
  });

  it("tidak pernah negatif", () => {
    expect(skipFor({ q: "", page: 1, pageSize: 20 }, 0)).toBe(0);
  });
});

describe("buildPage", () => {
  it("menghitung jumlah halaman dari total hasil", () => {
    const page = buildPage([], 45, { q: "", page: 1, pageSize: 20 });
    expect(page.pageCount).toBe(3);
  });

  it("selalu menyisakan satu halaman meski hasilnya kosong", () => {
    const page = buildPage([], 0, { q: "cari", page: 1, pageSize: 20 });
    expect(page.pageCount).toBe(1);
    expect(page.page).toBe(1);
    expect(page.total).toBe(0);
  });

  it("menurunkan nomor halaman yang melewati batas", () => {
    const page = buildPage([], 25, { q: "", page: 9, pageSize: 20 });
    expect(page.page).toBe(2);
  });

  it("mengembalikan kata pencarian apa adanya agar antarmuka dapat menyebutnya", () => {
    expect(buildPage([], 1, { q: "nadia", page: 1, pageSize: 20 }).q).toBe("nadia");
  });
});
