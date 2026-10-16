/**
 * Membedakan postingan yang MENCARI jasa dari yang MENAWARKAN jasa.
 *
 * Pencarian kata kunci tidak bisa memisahkan keduanya: "jasa pembuatan
 * website" muncul baik dari calon pelanggan maupun dari pesaing yang sedang
 * berjualan. Bagi pengguna, separuh feed jadi tidak berguna.
 *
 * Penilaiannya berbasis frasa, bukan kata tunggal, karena kata yang sama
 * berbalik arti tergantung rangkaiannya: "aku butuh jasa ketik" adalah
 * permintaan, sedangkan "kalau ada yang butuh jasa ketik" justru penawaran.
 *
 * Murni dan tanpa jaringan, jadi aturannya dapat diuji dengan contoh nyata.
 */

export type LeadIntent = "mencari" | "menawarkan" | "tidak jelas";

export const LEAD_INTENT_LABEL: Record<LeadIntent, string> = {
  mencari: "Mencari jasa",
  menawarkan: "Menawarkan jasa",
  "tidak jelas": "Belum jelas",
};

type Rule = { pattern: RegExp; weight: number };

/** Permintaan: penulis sendiri yang sedang membutuhkan. */
const SEEKING: Rule[] = [
  { pattern: /\b(aku|saya|gue|gw|ane|kami|kita)\s+(lagi\s+)?(butuh|cari|nyari|mencari|perlu|mau\s+cari)\b/, weight: 3 },
  { pattern: /\blagi\s+(butuh|cari|nyari|mencari|hunting)\b/, weight: 3 },
  { pattern: /\b(minta|mohon|boleh\s+minta)\s+(rekomendasi|saran|info|rekom)\b/, weight: 3 },
  { pattern: /\brekomendasi(nya)?\s*(dong|dong\s*kak|ya|yuk)?\b/, weight: 2 },
  { pattern: /\b(ada\s+yang\s+(tau|tahu|bisa|punya)|adakah|siapa\s+yang\s+(bisa|tau|tahu))\b/, weight: 2 },
  { pattern: /\b(butuh|cari|nyari)\s+(jasa|vendor|orang|partner|freelancer|supplier)\b/, weight: 2 },
  { pattern: /\b(tolong|help)\s+(rekomendasi|cariin|bantu\s+cari)\b/, weight: 3 },
  { pattern: /\b(mau|pengen|pingin)\s+(bikin|buat|pesan|order|sewa|renovasi)\b/, weight: 2 },
  { pattern: /\bada\s+rekomendasi\b/, weight: 3 },
  { pattern: /\bbudget\s*(ku|saya|nya)?\s*\d/, weight: 2 },
];

/** Penawaran: penulis sedang menjual atau membuka jasa. */
const OFFERING: Rule[] = [
  { pattern: /\b(menyediakan|menerima|melayani|terima)\s+(jasa|pesanan|order|orderan)\b/, weight: 4 },
  { pattern: /\b(open|buka)\s+(jasa|order|orderan|slot|komisi|po)\b/, weight: 4 },
  { pattern: /\b(kalau|kalo|klo|jika|bila|buat|bagi|yang|yg|siapa)\s+(ada\s+)?(yang\s+|yg\s+)?(butuh|mau|minat|perlu|cari)\b/, weight: 3 },
  { pattern: /\b(jasa|layanan)\s*(saya|aku|kami|kita|gue)\b/, weight: 3 },
  { pattern: /\b(harga|mulai|start)\s*(dari\s*)?(rp)?\s*\d+\s*(rb|ribu|k|jt|juta)\b/, weight: 3 },
  { pattern: /\b(dm|chat|wa|whatsapp|hubungi|kontak)\s*(aku|saya|kami|ya|yuk|langsung|admin)?\b.*\b(order|pesan|info|harga|konsultasi)\b/, weight: 2 },
  { pattern: /\b(bisa\s+bantu|siap\s+bantu|aku\s+bisa\s+bantuin)\b/, weight: 2 },
  { pattern: /\b(free\s*)?(konsultasi|portofolio|portfolio)\s+(gratis|bisa\s+dilihat|kami|kita)\b/, weight: 2 },
  { pattern: /\b(ready|promo|diskon|garansi|free\s+revisi|include)\b/, weight: 1 },
  { pattern: /\b(freelance|freelancer|jasa)\s+(murah|terjangkau|profesional|berpengalaman)\b/, weight: 2 },
  { pattern: /\b(kami|kita)\s+(melayani|mengerjakan|menawarkan|siap)\b/, weight: 3 },
];

function score(text: string, rules: Rule[]) {
  return rules.reduce((total, rule) => total + (rule.pattern.test(text) ? rule.weight : 0), 0);
}

function normalize(text: string) {
  return text.toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
}

/**
 * Hanya menyimpulkan ketika salah satu sisi menang cukup jelas. Postingan
 * yang ambigu dibiarkan "tidak jelas" supaya penyaring tidak membuang lead
 * yang sebenarnya berguna.
 */
export function classifyLeadIntent(body: string): LeadIntent {
  const text = normalize(body);
  const seeking = score(text, SEEKING);
  const offering = score(text, OFFERING);

  if (seeking === 0 && offering === 0) return "tidak jelas";
  if (seeking > offering) return "mencari";
  if (offering > seeking) return "menawarkan";
  return "tidak jelas";
}
