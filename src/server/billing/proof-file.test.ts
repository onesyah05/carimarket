import { describe, expect, it } from "vitest";
import { detectProofType, PROOF_MAX_BYTES, PROOF_TYPE_LABELS, proofFileName } from "./proof-file";

function bytes(...values: number[]) {
  return new Uint8Array([...values, ...new Array(16).fill(0)]);
}

describe("detectProofType", () => {
  it("mengenali jenis yang diterima dari isi berkas", () => {
    expect(detectProofType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    expect(detectProofType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe("image/png");
    expect(detectProofType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))?.mime).toBe("application/pdf");
    expect(detectProofType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))?.mime).toBe("image/webp");
  });

  it("menolak RIFF yang bukan WebP", () => {
    expect(detectProofType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20]))).toBeNull();
  });

  it("menolak berkas yang dapat dieksekusi peramban", () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    const svg = new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>");
    expect(detectProofType(html)).toBeNull();
    expect(detectProofType(svg)).toBeNull();
  });

  it("menolak berkas kosong atau terlalu pendek untuk dikenali", () => {
    expect(detectProofType(new Uint8Array())).toBeNull();
    expect(detectProofType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });

  it("tidak tertipu nama berkas, karena hanya isi yang diperiksa", () => {
    const pdfBytes = bytes(0x25, 0x50, 0x44, 0x46);
    expect(detectProofType(pdfBytes)?.extension).toBe("pdf");
  });
});

describe("proofFileName", () => {
  it("membuang nama kiriman dan memakai id tagihan serta ekstensi hasil deteksi", () => {
    const type = detectProofType(bytes(0xff, 0xd8, 0xff))!;
    expect(proofFileName("clz2trx0001", "a1b2c3", type)).toBe("clz2trx0001-a1b2c3.jpg");
  });
});

describe("batas unggahan", () => {
  it("membatasi ukuran pada 4 MB dan menyebut jenis yang diterima", () => {
    expect(PROOF_MAX_BYTES).toBe(4 * 1024 * 1024);
    expect(PROOF_TYPE_LABELS).toBe("JPG, PNG, WebP, PDF");
  });
});
