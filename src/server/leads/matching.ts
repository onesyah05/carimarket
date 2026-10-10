/**
 * Logika pencocokan kata kunci tanpa akses database.
 *
 * Dipisahkan dari `search-service` agar aturan relevansi dan penyaringan kata
 * kunci negatif dapat diuji langsung tanpa koneksi MySQL maupun Threads.
 */

export function normalizeTerm(value: string) {
  return value.trim().toLocaleLowerCase("id-ID");
}

/** Skor relevansi 70–100 berdasarkan jumlah kata kunci yang muncul di postingan. */
export function relevanceScore(body: string, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = terms.filter(term => body.toLowerCase().includes(term)).length;
  return Math.min(100, Math.round(70 + (matches / Math.max(terms.length, 1)) * 30));
}

/**
 * Mengembalikan kata kunci negatif pertama yang muncul pada postingan, atau
 * null bila postingan lolos seluruh penyaringan.
 *
 * Pencocokan dilakukan pada batas kata agar "gratis" tidak menandai
 * "gratisan" secara tidak sengaja, sementara frasa multi-kata tetap dicocokkan
 * sebagai satu kesatuan.
 */
export function matchedExcludedTerm(body: string, excludedTerms: string[]): string | null {
  const haystack = normalizeTerm(body);
  if (!haystack) return null;
  for (const term of excludedTerms) {
    const needle = normalizeTerm(term);
    if (!needle) continue;
    if (containsWord(haystack, needle)) return needle;
  }
  return null;
}

function containsWord(haystack: string, needle: string) {
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    const before = index === 0 ? "" : haystack[index - 1];
    const after = haystack[index + needle.length] ?? "";
    if (!isWordCharacter(before) && !isWordCharacter(after)) return true;
    index = haystack.indexOf(needle, index + 1);
  }
  return false;
}

function isWordCharacter(character: string) {
  return character !== "" && /[\p{L}\p{N}]/u.test(character);
}
