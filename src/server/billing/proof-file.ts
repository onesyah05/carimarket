/**
 * Aturan berkas bukti pembayaran, dipisahkan dari penyimpanannya agar dapat
 * diuji tanpa basis data maupun sistem berkas.
 */

export const PROOF_MAX_BYTES = 4 * 1024 * 1024;

export type ProofType = { mime: string; extension: string; label: string };

export const PROOF_TYPES: ProofType[] = [
  { mime: "image/jpeg", extension: "jpg", label: "JPG" },
  { mime: "image/png", extension: "png", label: "PNG" },
  { mime: "image/webp", extension: "webp", label: "WebP" },
  { mime: "application/pdf", extension: "pdf", label: "PDF" },
];

export const PROOF_ACCEPT_ATTRIBUTE = PROOF_TYPES.map(type => type.mime).join(",");
export const PROOF_TYPE_LABELS = PROOF_TYPES.map(type => type.label).join(", ");

/**
 * Jenis berkas ditentukan dari angka ajaib di awal isi, bukan dari nama berkas
 * maupun header `Content-Type` kiriman yang sama-sama dapat dipalsukan. HTML
 * dan SVG karena itu selalu ditolak, sehingga tidak ada berkas yang dapat
 * dieksekusi peramban saat bukti dibuka tim verifikasi.
 */
export function detectProofType(bytes: Uint8Array): ProofType | null {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (startsWith(0xff, 0xd8, 0xff)) return PROOF_TYPES[0];
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return PROOF_TYPES[1];
  // RIFF....WEBP: empat huruf penanda format berada pada byte ke-8.
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return PROOF_TYPES[2];
  }
  if (startsWith(0x25, 0x50, 0x44, 0x46)) return PROOF_TYPES[3];
  return null;
}

/** Nama berkas simpanan selalu dibuat ulang; nama kiriman tidak pernah dipakai. */
export function proofFileName(transactionId: string, randomSuffix: string, type: ProofType) {
  return `${transactionId}-${randomSuffix}.${type.extension}`;
}
