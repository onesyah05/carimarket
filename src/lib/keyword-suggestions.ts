/**
 * Satu kata kunci pencarian milik pengguna, dipakai halaman lead untuk
 * menunjukkan apa yang akan dijalankan tombol "Cari leads sekarang".
 */
export type KeywordSuggestion = {
  phrase: string;
  /** Jumlah lead yang pernah ditemukan kata kunci ini. */
  matches: number;
  /** Terakhir dipakai mencari (ISO, UTC); null bila belum pernah dijalankan. */
  lastUsedAt: string | null;
  /** Kata kunci yang dijeda tetap disarankan, tetapi ditandai. */
  active: boolean;
};

/**
 * Keterangan singkat di bawah tiap saran: kapan terakhir dipakai, berapa lead
 * yang pernah dihasilkan, dan apakah kata kuncinya sedang dijeda.
 *
 * `now` dapat diisi agar hasilnya dapat diuji tanpa bergantung jam sistem.
 */
export function suggestionMeta(suggestion: KeywordSuggestion, now = Date.now()): string {
  const parts: string[] = [];

  if (suggestion.lastUsedAt) {
    // Dibulatkan ke bawah supaya "baru saja" benar-benar berarti di bawah satu menit.
    const minutes = Math.floor((now - new Date(suggestion.lastUsedAt).getTime()) / 60_000);
    if (minutes < 1) parts.push("baru saja");
    else if (minutes < 60) parts.push(`${minutes} menit lalu`);
    else if (minutes < 1440) parts.push(`${Math.round(minutes / 60)} jam lalu`);
    else parts.push(`${Math.round(minutes / 1440)} hari lalu`);
  } else {
    parts.push("belum pernah dijalankan");
  }

  if (suggestion.matches > 0) parts.push(`${suggestion.matches} lead`);
  if (!suggestion.active) parts.push("dijeda");

  return parts.join(" · ");
}
