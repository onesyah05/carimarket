import { detectProofType, type ProofType } from "./proof-file";

/**
 * Aturan berkas gambar QR, dipisahkan dari penyimpanannya agar dapat diuji
 * tanpa basis data.
 *
 * Deteksi jenisnya memakai pembacaan angka ajaib milik bukti pembayaran —
 * bagian yang menentukan keamanan — lalu mempersempitnya ke berkas yang
 * benar-benar dapat ditampilkan sebagai gambar. PDF ditolak di sini meskipun
 * sah sebagai bukti pembayaran: gambar ini dipasang dengan <img> pada halaman
 * pembayaran, dan PDF tidak akan tampil di sana.
 */

export const QR_MAX_BYTES = 2 * 1024 * 1024;

export type QrImageType = ProofType;

export const QR_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

export const QR_ACCEPT_ATTRIBUTE = QR_IMAGE_MIMES.join(",");
export const QR_TYPE_LABELS = "JPG, PNG, WebP";

/**
 * Jenis ditentukan dari isi berkas, bukan dari namanya maupun header
 * `Content-Type` kiriman yang sama-sama dapat dipalsukan. SVG karena itu tidak
 * pernah lolos: ia dapat memuat skrip, dan gambar ini ditampilkan kepada tiap
 * pelanggan yang membuka tagihan.
 */
export function detectQrImageType(bytes: Uint8Array): QrImageType | null {
  const type = detectProofType(bytes);
  if (!type) return null;
  return (QR_IMAGE_MIMES as readonly string[]).includes(type.mime) ? type : null;
}
