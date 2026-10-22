import "server-only";
import type { Role } from "@prisma/client";

/**
 * Kontrak tabel konsol internal.
 *
 * Satu bentuk untuk semua tabel supaya komponen klien tidak perlu tahu domain
 * apa pun: ia hanya mengirim `q`, `page`, `pageSize` dan menerima baris yang
 * sudah siap ditampilkan.
 *
 * Pencarian dijalankan di database, bukan di halaman yang sedang tampil. Itu
 * keputusan pokoknya: tabel yang hanya menyaring 30 baris pertama akan
 * menjawab "tidak ditemukan" untuk data yang jelas-jelas ada, dan itu lebih
 * buruk daripada tidak punya pencarian sama sekali.
 */

export type TableQuery = {
  /** Kata pencarian; kosong berarti tanpa penyaringan. */
  q: string;
  /** Halaman berbasis satu. */
  page: number;
  pageSize: number;
};

/** Baris sudah diserialisasi: tanggal menjadi string ISO, Decimal menjadi number. */
export type TableRow = Record<string, unknown>;

export type TablePage = {
  rows: TableRow[];
  /** Jumlah baris yang cocok dengan pencarian, bukan jumlah seluruh tabel. */
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  q: string;
};

export type TableDefinition = {
  /** Peran yang boleh membaca tabel ini. */
  roles: Role[];
  /** Kolom yang ikut dicari, untuk ditampilkan sebagai petunjuk di kotak pencarian. */
  searchHint: string;
  run(query: TableQuery): Promise<TablePage>;
};

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** Membersihkan masukan dari klien sebelum menyentuh database. */
export function normalizeQuery(input: Partial<TableQuery>): TableQuery {
  const pageSize = PAGE_SIZE_OPTIONS.includes(input.pageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? (input.pageSize as number)
    : DEFAULT_PAGE_SIZE;
  const page = Number.isFinite(input.page) && (input.page as number) > 0 ? Math.trunc(input.page as number) : 1;
  // Batas panjang menjaga agar kueri pencarian tidak menjadi beban sendiri.
  return { q: (input.q ?? "").trim().slice(0, 120), page, pageSize };
}

/**
 * Menyusun hasil halaman dan mengoreksi nomor halaman yang melewati batas.
 *
 * Mengetik pencarian sering memangkas jumlah halaman; tanpa koreksi ini
 * pengguna akan melihat tabel kosong padahal hasilnya ada di halaman pertama.
 */
export function buildPage(rows: TableRow[], total: number, query: TableQuery): TablePage {
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  return {
    rows,
    total,
    page: Math.min(query.page, pageCount),
    pageSize: query.pageSize,
    pageCount,
    q: query.q,
  };
}

/** Lompatan baris untuk halaman yang diminta, sudah dijaga agar tidak negatif. */
export function skipFor(query: TableQuery, total: number) {
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  return (page - 1) * query.pageSize;
}
