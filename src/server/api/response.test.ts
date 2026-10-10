import { describe, expect, it } from "vitest";
import {
  API_ERROR_CODES,
  buildMeta,
  errorBody,
  pageMeta,
  resolvePagination,
  statusForCode,
  successBody,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
} from "./response";

const requestId = "0f2b7c18-6f1a-4f0d-9d1b-2f1a3b4c5d6e";
const now = new Date("2026-10-10T08:00:00.000Z");

describe("amplop respons", () => {
  it("memakai bentuk yang sama untuk keberhasilan", () => {
    const body = successBody({ id: "lead-1" }, buildMeta(requestId, undefined, now));
    expect(body).toEqual({
      success: true,
      data: { id: "lead-1" },
      meta: { requestId, timestamp: "2026-10-10T08:00:00.000Z" },
    });
  });

  it("memakai bentuk yang sama untuk kegagalan", () => {
    const body = errorBody("NOT_FOUND", "Lead tidak ditemukan.", buildMeta(requestId, undefined, now));
    expect(body).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Lead tidak ditemukan.", details: null },
      meta: { requestId, timestamp: "2026-10-10T08:00:00.000Z" },
    });
  });

  it("menyertakan detail kolom saat validasi gagal", () => {
    const body = errorBody("INVALID_INPUT", "Permintaan tidak valid.", buildMeta(requestId, undefined, now), { query: "Minimal 2 karakter." });
    expect(body.error.details).toEqual({ query: "Minimal 2 karakter." });
  });

  it("menambahkan meta.page hanya untuk daftar", () => {
    expect(buildMeta(requestId, undefined, now).page).toBeUndefined();
    expect(buildMeta(requestId, pageMeta(2, 20, 42), now).page).toEqual({
      page: 2, perPage: 20, total: 42, totalPages: 3, hasMore: true,
    });
  });
});

describe("pageMeta", () => {
  it("menghitung jumlah halaman dan penanda lanjutan", () => {
    expect(pageMeta(1, 20, 0)).toEqual({ page: 1, perPage: 20, total: 0, totalPages: 0, hasMore: false });
    expect(pageMeta(3, 20, 42)).toEqual({ page: 3, perPage: 20, total: 42, totalPages: 3, hasMore: false });
    expect(pageMeta(1, 10, 25)).toEqual({ page: 1, perPage: 10, total: 25, totalPages: 3, hasMore: true });
  });
});

describe("resolvePagination", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("memakai nilai bawaan saat parameter tidak ada", () => {
    expect(resolvePagination(params(""))).toEqual({ page: 1, perPage: DEFAULT_PER_PAGE, skip: 0, take: DEFAULT_PER_PAGE });
  });

  it("menghitung skip dari halaman", () => {
    expect(resolvePagination(params("page=3&perPage=10"))).toEqual({ page: 3, perPage: 10, skip: 20, take: 10 });
  });

  it("menolak nilai di luar rentang tanpa melempar", () => {
    expect(resolvePagination(params("page=0&perPage=0")).page).toBe(1);
    expect(resolvePagination(params("perPage=9999")).perPage).toBe(MAX_PER_PAGE);
    expect(resolvePagination(params("page=-5")).page).toBe(1);
    expect(resolvePagination(params("page=abc")).page).toBe(1);
  });
});

describe("statusForCode", () => {
  it("memetakan kode terdokumentasi ke status HTTP", () => {
    expect(statusForCode("UNAUTHENTICATED")).toBe(401);
    expect(statusForCode("NOT_FOUND")).toBe(404);
    expect(statusForCode("QUOTA_EXCEEDED")).toBe(429);
  });

  it("memakai 500 untuk kode yang tidak dikenal", () => {
    expect(statusForCode("KODE_ASING")).toBe(500);
  });

  it("menjaga setiap kode punya status dan pesan", () => {
    for (const [code, detail] of Object.entries(API_ERROR_CODES)) {
      expect(detail.status, code).toBeGreaterThanOrEqual(400);
      expect(detail.message.length, code).toBeGreaterThan(10);
    }
  });
});
