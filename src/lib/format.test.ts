import { describe, expect, it } from "vitest";
import { formatRupiah, statusLabel } from "./format";

describe("formatRupiah", () => {
  it("menulis harga paket dengan pemisah ribuan Indonesia", () => {
    expect(formatRupiah(98_000)).toBe("Rp 98.000");
    expect(formatRupiah(149_000)).toBe("Rp 149.000");
    expect(formatRupiah(1_250_000)).toBe("Rp 1.250.000");
  });

  it("menyebut nol sebagai gratis dan dapat diganti labelnya", () => {
    expect(formatRupiah(0)).toBe("Gratis");
    expect(formatRupiah(0, { zeroLabel: "Rp 0" })).toBe("Rp 0");
  });

  it("tidak memakai desimal", () => {
    expect(formatRupiah(98_000.4)).toBe("Rp 98.000");
  });

  it("memakai spasi biasa setelah Rp", () => {
    expect(formatRupiah(98_000)).not.toContain(" ");
  });

  it("mengembalikan tanda hubung untuk nilai tidak valid", () => {
    expect(formatRupiah(Number.NaN)).toBe("—");
  });
});

describe("statusLabel", () => {
  it("menerjemahkan status yang dikenal", () => {
    expect(statusLabel("ACTIVE")).toBe("Aktif");
    expect(statusLabel("TRIAL")).toBe("Uji coba");
  });

  it("mengembalikan kunci asli bila belum diterjemahkan", () => {
    expect(statusLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(statusLabel(null)).toBe("—");
  });
});
