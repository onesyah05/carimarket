/**
 * Katalog paket langganan Cari Market.
 *
 * Satu sumber kebenaran untuk harga dan kuota: dipakai skrip sinkronisasi
 * (`npm run db:plans`), seed pengembangan, dan halaman harga publik melalui
 * tabel `Plan`.
 *
 * Angka kuota dipilih agar tetap di bawah batas Meta yang berlaku per akun
 * Threads yang terhubung: 2.200 permintaan `keyword_search` per 24 jam dan
 * kurang lebih 1.000 balasan per 24 jam. Batas balasan bulanan juga dijaga
 * sejalan dengan batas harian default mode otomatis (10 balasan per hari).
 *
 * `searchIntervalHours` menjaga agar jadwal pencarian benar-benar muat dalam
 * kuota bulanan: jumlah kata kunci x (24 / interval) x 30 hari tidak boleh
 * melampaui `monthlySearchLimit`.
 */

export type PlanCatalogEntry = {
  code: string;
  name: string;
  /** Harga per bulan dalam Rupiah. */
  monthlyPrice: number;
  monthlySearchLimit: number;
  monthlyReplyLimit: number;
  keywordLimit: number;
  /** Jarak minimum antar pencarian terjadwal, dalam jam. */
  searchIntervalHours: number;
  /** Ringkasan untuk halaman harga; tidak disimpan di database. */
  tagline: string;
  highlights: string[];
  featured?: boolean;
};

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    code: "STARTER",
    name: "Starter",
    monthlyPrice: 0,
    monthlySearchLimit: 300,
    monthlyReplyLimit: 30,
    keywordLimit: 3,
    searchIntervalHours: 24,
    tagline: "Untuk menguji apakah ada percakapan yang relevan dengan layanan Anda.",
    highlights: [
      "3 kata kunci termasuk kata negatif",
      "Pencarian terjadwal sekali sehari",
      "300 pencarian per bulan",
      "30 balasan per bulan",
      "Mode tinjau dulu, riwayat, dan ekspor data",
    ],
  },
  {
    code: "BISNIS",
    name: "Bisnis",
    monthlyPrice: 98_000,
    monthlySearchLimit: 2_000,
    monthlyReplyLimit: 300,
    keywordLimit: 10,
    searchIntervalHours: 6,
    tagline: "Untuk satu bisnis yang menanggapi lead setiap hari.",
    highlights: [
      "10 kata kunci termasuk kata negatif",
      "Pencarian terjadwal tiap 6 jam",
      "2.000 pencarian per bulan",
      "300 balasan per bulan, setara 10 per hari",
      "Mode balas otomatis dengan ambang relevansi, jeda, dan jam tenang",
      "Penahanan draft berisiko dan antrean moderasi",
    ],
    featured: true,
  },
  {
    code: "PRO",
    name: "Pro",
    monthlyPrice: 149_000,
    monthlySearchLimit: 6_000,
    monthlyReplyLimit: 800,
    keywordLimit: 25,
    searchIntervalHours: 3,
    tagline: "Untuk beberapa layanan atau area sekaligus dengan volume lebih tinggi.",
    highlights: [
      "25 kata kunci termasuk kata negatif",
      "Pencarian terjadwal tiap 3 jam",
      "6.000 pencarian per bulan",
      "800 balasan per bulan, masih di bawah batas harian Meta",
      "Prioritas dukungan melalui formulir kontak",
    ],
  },
];

export function findPlan(code: string) {
  return PLAN_CATALOG.find(plan => plan.code === code);
}
