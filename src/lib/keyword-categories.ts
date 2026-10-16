/**
 * Kaitan antara kategori bisnis dan kata kunci pencarian.
 *
 * Dua gunanya: menyarankan frasa yang benar-benar dipakai orang di tiap bidang,
 * dan menolak kata kunci yang jelas milik bidang lain. Penolakan sengaja
 * sempit — hanya ketika frasa memuat penanda khas kategori lain dan tidak
 * memuat penanda kategorinya sendiri. Frasa umum seperti "butuh jasa" atau
 * nama kota tetap bebas, karena melarang terlalu banyak akan menghalangi
 * bisnis yang memakai istilah khasnya sendiri.
 *
 * Murni: tidak menyentuh database, dipakai di server (penegakan) maupun di
 * klien (saran dan peringatan dini).
 */

export type CategoryKeywords = {
  /** Frasa siap pakai yang ditawarkan saat onboarding. */
  suggestions: string[];
  /** Kata khas kategori ini; dasar penolakan lintas kategori. */
  markers: string[];
};

/** Kategori tanpa penanda: tidak ada yang dapat dinilai melenceng. */
export const OPEN_CATEGORY = "Lainnya";

export const CATEGORY_KEYWORDS: Record<string, CategoryKeywords> = {
  "Jasa kreatif": {
    suggestions: [
      "jasa desain logo",
      "jasa desain grafis",
      "cari fotografer produk",
      "jasa edit video",
      "butuh desainer feed",
      "jasa branding umkm",
    ],
    markers: ["desain", "desainer", "logo", "grafis", "fotografer", "fotografi", "videografer", "edit video", "branding", "ilustrasi"],
  },
  "Jasa Drone": {
    suggestions: [
      "jasa drone",
      "foto udara",
      "video aerial",
      "jasa pemetaan drone",
      "sewa drone",
      "dokumentasi udara",
    ],
    markers: ["drone", "aerial", "foto udara", "udara", "pemetaan", "mapping"],
  },
  Properti: {
    suggestions: [
      "cari kontraktor rumah",
      "jasa interior rumah",
      "cari rumah dijual",
      "jasa renovasi rumah",
      "sewa ruko",
      "cari kost bulanan",
    ],
    markers: ["rumah", "ruko", "kost", "kontraktor", "interior", "renovasi", "properti", "apartemen", "tanah kavling", "arsitek"],
  },
  Konsultan: {
    suggestions: [
      "jasa konsultan pajak",
      "cari konsultan bisnis",
      "jasa pendirian pt",
      "konsultan legalitas usaha",
      "jasa pembuatan izin usaha",
      "cari konsultan keuangan",
    ],
    markers: ["konsultan", "pajak", "legalitas", "pendirian pt", "izin usaha", "notaris", "akuntan", "audit"],
  },
  Retail: {
    suggestions: [
      "cari supplier grosir",
      "cari reseller",
      "jual beli stok",
      "supplier baju murah",
      "cari dropshipper",
      "grosir kebutuhan toko",
    ],
    markers: ["grosir", "supplier", "reseller", "dropship", "dropshipper", "toko online", "stok barang", "distributor"],
  },
  Kuliner: {
    suggestions: [
      "cari catering",
      "pesan kue ulang tahun",
      "catering kantor",
      "cari paket nasi box",
      "jasa masak acara",
      "cari frozen food",
    ],
    markers: ["catering", "kue", "nasi box", "masak", "kuliner", "frozen food", "makanan", "minuman", "snack"],
  },
  Pendidikan: {
    suggestions: [
      "cari guru les privat",
      "bimbel online",
      "les bahasa inggris",
      "cari tutor matematika",
      "kursus online",
      "cari mentor skripsi",
    ],
    markers: ["les", "bimbel", "tutor", "kursus", "guru privat", "skripsi", "pelatihan", "mentor belajar"],
  },
  Kesehatan: {
    suggestions: [
      "cari fisioterapi",
      "jasa perawat home care",
      "cari klinik gigi",
      "konsultasi gizi",
      "cari terapis pijat",
      "home care lansia",
    ],
    markers: ["klinik", "dokter", "perawat", "fisioterapi", "home care", "terapis", "gizi", "apotek", "kesehatan"],
  },
  Teknologi: {
    suggestions: [
      "jasa pembuatan website",
      "cari developer aplikasi",
      "jasa pembuatan aplikasi",
      "butuh jasa it support",
      "jasa maintenance website",
      "cari programmer freelance",
    ],
    markers: ["website", "aplikasi", "developer", "programmer", "it support", "sistem informasi", "software", "api", "hosting"],
  },
  [OPEN_CATEGORY]: { suggestions: [], markers: [] },
};

export function categorySuggestions(category: string): string[] {
  return CATEGORY_KEYWORDS[category]?.suggestions ?? [];
}

function normalize(value: string) {
  return ` ${value.toLocaleLowerCase("id-ID").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
}

/** `haystack` sudah dinormalkan dan berpagar spasi, jadi ini kecocokan utuh kata. */
function hasMarker(haystack: string, markers: string[]) {
  return markers.some(marker => haystack.includes(` ${marker} `));
}

export type KeywordCategoryCheck =
  | { ok: true }
  | { ok: false; conflictCategory: string; message: string };

/**
 * Menilai apakah sebuah kata kunci pencarian masuk akal untuk kategori akun.
 *
 * Hanya menolak bila frasa memuat penanda kategori lain sementara kategorinya
 * sendiri tidak terwakili sama sekali.
 */
export function checkKeywordCategory(phrase: string, category: string): KeywordCategoryCheck {
  const own = CATEGORY_KEYWORDS[category];
  if (!own || own.markers.length === 0) return { ok: true };

  const haystack = normalize(phrase);
  if (hasMarker(haystack, own.markers)) return { ok: true };

  for (const [name, entry] of Object.entries(CATEGORY_KEYWORDS)) {
    if (name === category || entry.markers.length === 0) continue;
    if (hasMarker(haystack, entry.markers)) {
      return {
        ok: false,
        conflictCategory: name,
        message: `Kata kunci ini terdengar seperti bidang ${name}, sedangkan akun Anda terdaftar di kategori ${category}. Pakai istilah yang dicari pelanggan ${category}, atau hubungi dukungan bila kategori akun perlu diubah.`,
      };
    }
  }

  return { ok: true };
}
