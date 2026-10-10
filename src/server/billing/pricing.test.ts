import { describe, expect, it } from "vitest";
import {
  MAX_UNIQUE_CODE,
  MIN_UNIQUE_CODE,
  addMonths,
  buildInvoiceNumber,
  computeAmounts,
  isOpenStatus,
  jakartaDateStamp,
  paymentExpiryFrom,
  pickUniqueCode,
  resolveBillingPeriod,
  transactionStatusLabel,
} from "./pricing";

describe("computeAmounts", () => {
  it("mengalikan harga bulanan dengan durasi lalu menambahkan kode unik", () => {
    expect(computeAmounts({ monthlyPrice: 98_000, periodMonths: 3, uniqueCode: 417 })).toEqual({
      baseAmount: 294_000,
      totalAmount: 294_417,
    });
  });

  it("menjaga nominal tetap bilangan bulat Rupiah", () => {
    const amounts = computeAmounts({ monthlyPrice: 149_000.5, periodMonths: 1, uniqueCode: 1 });
    expect(Number.isInteger(amounts.baseAmount)).toBe(true);
    expect(Number.isInteger(amounts.totalAmount)).toBe(true);
  });
});

describe("pickUniqueCode", () => {
  it("menghindari kode yang sedang dipakai tagihan terbuka lain", () => {
    const code = pickUniqueCode([1, 2, 3], () => 0);
    expect(code).toBe(4);
  });

  it("selalu berada dalam rentang yang dapat dibaca pada mutasi", () => {
    for (let index = 0; index < 50; index += 1) {
      const code = pickUniqueCode([]);
      expect(code).toBeGreaterThanOrEqual(MIN_UNIQUE_CODE);
      expect(code).toBeLessThanOrEqual(MAX_UNIQUE_CODE);
    }
  });

  it("tetap mengembalikan kode walau seluruh kode terpakai", () => {
    const all = Array.from({ length: MAX_UNIQUE_CODE }, (_, index) => index + 1);
    const code = pickUniqueCode(all, () => 0.5);
    expect(code).toBeGreaterThanOrEqual(MIN_UNIQUE_CODE);
    expect(code).toBeLessThanOrEqual(MAX_UNIQUE_CODE + MIN_UNIQUE_CODE);
  });
});

describe("buildInvoiceNumber", () => {
  it("memakai tanggal Jakarta, bukan UTC", () => {
    // 19.00 UTC sudah tanggal berikutnya di Jakarta (WIB = UTC+7).
    expect(jakartaDateStamp(new Date("2026-10-11T19:00:00.000Z"))).toBe("20261012");
    expect(buildInvoiceNumber(new Date("2026-10-11T19:00:00.000Z"), () => 0)).toBe("INV-20261012-0000");
  });

  it("berbentuk nomor yang dapat disebut pelanggan", () => {
    expect(buildInvoiceNumber(new Date("2026-10-11T02:00:00.000Z"))).toMatch(/^INV-20261011-[0-9A-Z]{4}$/);
  });
});

describe("addMonths", () => {
  it("menjepit tanggal yang tidak ada di bulan tujuan", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00.000Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T00:00:00.000Z"), 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("mempertahankan jam dan melewati batas tahun", () => {
    expect(addMonths(new Date("2026-11-15T08:30:00.000Z"), 3).toISOString()).toBe("2027-02-15T08:30:00.000Z");
  });
});

describe("resolveBillingPeriod", () => {
  const now = new Date("2026-10-11T10:00:00.000Z");

  it("memulai periode baru bila pelanggan belum punya langganan", () => {
    const period = resolveBillingPeriod({ now, months: 1, planId: "plan-bisnis", current: null });
    expect(period.extended).toBe(false);
    expect(period.start).toEqual(now);
    expect(period.end.toISOString()).toBe("2026-11-11T10:00:00.000Z");
  });

  it("memperpanjang sisa periode saat paketnya sama", () => {
    const period = resolveBillingPeriod({
      now,
      months: 1,
      planId: "plan-bisnis",
      current: {
        planId: "plan-bisnis",
        currentPeriodStart: new Date("2026-09-20T10:00:00.000Z"),
        currentPeriodEnd: new Date("2026-10-20T10:00:00.000Z"),
      },
    });
    expect(period.extended).toBe(true);
    expect(period.start.toISOString()).toBe("2026-09-20T10:00:00.000Z");
    // Sisa sembilan hari tidak hangus: periode baru dihitung dari akhir lama.
    expect(period.end.toISOString()).toBe("2026-11-20T10:00:00.000Z");
  });

  it("memulai dari sekarang saat pelanggan pindah paket", () => {
    const period = resolveBillingPeriod({
      now,
      months: 1,
      planId: "plan-pro",
      current: {
        planId: "plan-bisnis",
        currentPeriodStart: new Date("2026-09-20T10:00:00.000Z"),
        currentPeriodEnd: new Date("2026-10-20T10:00:00.000Z"),
      },
    });
    expect(period.extended).toBe(false);
    expect(period.start).toEqual(now);
    expect(period.end.toISOString()).toBe("2026-11-11T10:00:00.000Z");
  });

  it("tidak memperpanjang langganan yang periodenya sudah lewat", () => {
    const period = resolveBillingPeriod({
      now,
      months: 1,
      planId: "plan-bisnis",
      current: {
        planId: "plan-bisnis",
        currentPeriodStart: new Date("2026-08-01T10:00:00.000Z"),
        currentPeriodEnd: new Date("2026-09-01T10:00:00.000Z"),
      },
    });
    expect(period.extended).toBe(false);
    expect(period.start).toEqual(now);
  });
});

describe("status tagihan", () => {
  it("hanya menganggap tagihan yang masih menunggu sebagai terbuka", () => {
    expect(isOpenStatus("PENDING")).toBe(true);
    expect(isOpenStatus("REVIEW")).toBe(true);
    expect(isOpenStatus("PAID")).toBe(false);
    expect(isOpenStatus("REJECTED")).toBe(false);
    expect(isOpenStatus("EXPIRED")).toBe(false);
    expect(isOpenStatus("CANCELLED")).toBe(false);
  });

  it("memberi label Indonesia untuk setiap status", () => {
    expect(transactionStatusLabel("PENDING")).toBe("Menunggu pembayaran");
    expect(transactionStatusLabel("REVIEW")).toBe("Menunggu verifikasi");
    expect(transactionStatusLabel("PAID")).toBe("Lunas");
  });
});

describe("paymentExpiryFrom", () => {
  it("memberi jendela pembayaran 24 jam", () => {
    expect(paymentExpiryFrom(new Date("2026-10-11T10:00:00.000Z")).toISOString()).toBe("2026-10-12T10:00:00.000Z");
  });
});
