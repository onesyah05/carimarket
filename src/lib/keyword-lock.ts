/**
 * Masa kunci kata kunci.
 *
 * Kata kunci yang baru dibuat tidak dapat dihapus selama 24 jam. Tujuannya
 * bukan menyulitkan pengguna, melainkan menahan pergantian bolak-balik:
 * tanpa ini, satu jatah kata kunci dapat ditukar berkali-kali dalam sehari
 * dan setiap pergantian memicu pencarian baru atas beban kuota yang sama.
 *
 * Menambah kata kunci baru tetap bebas selama jatah paket masih ada.
 */

export const KEYWORD_LOCK_HOURS = 24;

const LOCK_MS = KEYWORD_LOCK_HOURS * 60 * 60 * 1000;

export function keywordUnlockAt(createdAt: Date | string): Date {
  return new Date(new Date(createdAt).getTime() + LOCK_MS);
}

export function isKeywordLocked(createdAt: Date | string, now: Date | number = Date.now()): boolean {
  const reference = typeof now === "number" ? now : now.getTime();
  return keywordUnlockAt(createdAt).getTime() > reference;
}

/** "3 jam lagi" / "45 menit lagi" untuk pesan di antarmuka. */
export function lockRemainingLabel(createdAt: Date | string, now: Date | number = Date.now()): string {
  const reference = typeof now === "number" ? now : now.getTime();
  const minutes = Math.ceil((keywordUnlockAt(createdAt).getTime() - reference) / 60_000);
  if (minutes <= 0) return "sudah bisa diubah";
  if (minutes < 60) return `${minutes} menit lagi`;
  return `${Math.ceil(minutes / 60)} jam lagi`;
}
