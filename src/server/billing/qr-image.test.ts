import { describe, expect, it } from "vitest";
import { detectQrImageType, QR_ACCEPT_ATTRIBUTE, QR_MAX_BYTES } from "./qr-image";

/**
 * Gambar QR ditampilkan kepada tiap pelanggan yang membuka tagihan, jadi yang
 * diuji di sini adalah apa yang TIDAK boleh lolos.
 */

function bytes(...values: number[]) {
  return new Uint8Array([...values, ...new Array(24).fill(0)]);
}

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff);
const PDF = bytes(0x25, 0x50, 0x44, 0x46);

describe("detectQrImageType", () => {
  it("menerima PNG dan JPG", () => {
    expect(detectQrImageType(PNG)?.mime).toBe("image/png");
    expect(detectQrImageType(JPG)?.mime).toBe("image/jpeg");
  });

  it("menerima WebP yang penandanya ada di byte ke-8", () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, ...new Array(16).fill(0)]);
    expect(detectQrImageType(webp)?.mime).toBe("image/webp");
  });

  it("menolak PDF meski sah sebagai bukti pembayaran", () => {
    // Gambar ini dipasang dengan <img>; PDF tidak akan tampil di sana.
    expect(detectQrImageType(PDF)).toBeNull();
  });

  it("menolak SVG dan HTML, yang dapat memuat skrip", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    expect(detectQrImageType(svg)).toBeNull();
    expect(detectQrImageType(html)).toBeNull();
  });

  it("menolak berkas yang hanya BERNAMA gambar", () => {
    // Namanya tidak pernah dibaca; yang dibaca awal isinya.
    expect(detectQrImageType(new TextEncoder().encode("qris.png"))).toBeNull();
    expect(detectQrImageType(new Uint8Array())).toBeNull();
  });

  it("tidak menawarkan jenis yang ditolaknya di atribut accept", () => {
    expect(QR_ACCEPT_ATTRIBUTE).not.toContain("pdf");
    expect(QR_ACCEPT_ATTRIBUTE).not.toContain("svg");
    expect(QR_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
});
