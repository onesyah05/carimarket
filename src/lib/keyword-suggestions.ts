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
 * Saran kata kunci dari riwayat pencarian pengguna.
 *
 * Diurutkan dari yang paling mungkin diketik: awalan yang cocok lebih dulu,
 * lalu kecocokan di tengah kata. Urutan dasarnya sudah "terakhir dipakai"
 * dari server, dan urutan itu dipertahankan di dalam tiap kelompok supaya
 * kata kunci yang baru saja dicari tetap berada di atas.
 *
 * Murni dan tanpa jaringan: dipakai di komponen klien saat pengguna mengetik.
 */
export function matchSuggestions(all: KeywordSuggestion[], query: string, limit = 6): KeywordSuggestion[] {
  const needle = query.trim().toLocaleLowerCase("id-ID");
  if (!needle) return all.slice(0, limit);

  const prefix: KeywordSuggestion[] = [];
  const contains: KeywordSuggestion[] = [];
  for (const suggestion of all) {
    const phrase = suggestion.phrase.toLocaleLowerCase("id-ID");
    // Menyarankan persis apa yang sudah diketik tidak menambah apa pun.
    if (phrase === needle) continue;
    if (phrase.startsWith(needle)) prefix.push(suggestion);
    else if (phrase.includes(needle)) contains.push(suggestion);
  }
  return [...prefix, ...contains].slice(0, limit);
}

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
