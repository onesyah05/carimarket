import "server-only";
import { FaqTopic } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

/**
 * FAQ halaman publik.
 *
 * Teksnya dulu tertanam di komponen, jadi mengoreksi satu jawaban berarti
 * deploy. Sekarang dibaca dari database — tetapi halaman publik tetap punya
 * salinan bawaan di kode, karena halaman beranda tidak boleh kehilangan
 * seksinya hanya karena tabelnya masih kosong di instalasi baru.
 *
 * Daftar ini juga menjadi sumber structured data FAQPage, jadi jawaban yang
 * diubah di CMS ikut mengubah apa yang dibaca mesin pencari.
 */

export const faqSchema = z.object({
  question: z.string().trim().min(10, "Pertanyaan minimal 10 karakter.").max(255),
  answer: z.string().trim().min(20, "Jawaban minimal 20 karakter.").max(4_000),
  category: z.enum(["UMUM", "FITUR", "KEAMANAN", "HARGA"]),
  position: z.number().int().min(0).max(999),
  isActive: z.boolean(),
});

export type FaqInput = z.infer<typeof faqSchema>;

export type PublicFaq = {
  id: string;
  question: string;
  answer: string;
  category: FaqTopic;
};

export type ManagedFaq = PublicFaq & { position: number; isActive: boolean; updatedAt: string };

/**
 * Salinan bawaan.
 *
 * Isinya sengaja sama dengan yang dulu tertanam di komponen, supaya halaman
 * beranda pada instalasi baru tampil persis seperti sebelumnya.
 */
export const DEFAULT_FAQS: Array<Omit<ManagedFaq, "id" | "updatedAt">> = [
  {
    category: FaqTopic.UMUM,
    question: "Bagaimana cara kerja Cari Market menemukan calon klien?",
    answer: "Cari Market memindai percakapan publik di platform Threads berdasarkan kombinasi kata kunci kebutuhan bisnis, lokasi, dan konteks bahasa sehari-hari. Begitu ada postingan yang meminta rekomendasi jasa yang cocok dengan profil Anda, sistem menghitung skor relevansi 0–100 dan menyajikan lead ke feed workspace Anda.",
    position: 10,
    isActive: true,
  },
  {
    category: FaqTopic.FITUR,
    question: "Apakah balasan saya harus selalu diperiksa manual satu per satu?",
    answer: "Secara bawaan sistem berada di mode Tinjau Dulu: setiap draft balasan menunggu persetujuan Anda sebelum dikirim. Jika Anda sudah yakin dengan kata kunci dan aturan bisnis Anda, mode Balas Otomatis dapat diaktifkan dengan ambang skor relevansi, batas harian, jeda pengiriman, dan jam tenang.",
    position: 20,
    isActive: true,
  },
  {
    category: FaqTopic.KEAMANAN,
    question: "Apakah ada risiko akun Threads saya diblokir karena dianggap bot?",
    answer: "Risikonya tidak bisa kami nolkan, dan kami tidak akan mengklaim begitu. Yang kami lakukan adalah menekan polanya: mode tinjau dulu aktif sejak awal, mode otomatis mewajibkan ambang skor relevansi, jeda antar pengiriman, batas balasan harian, jam tenang, dan penyaringan kata terlarang yang menahan draft berisiko untuk ditinjau manusia.",
    position: 30,
    isActive: true,
  },
  {
    category: FaqTopic.KEAMANAN,
    question: "Bagaimana status integrasi Meta dan batasan pencarian?",
    answer: "Pencarian postingan publik Threads sudah aktif dan menemukan calon klien hari ini, tetapi masih memakai jalur sementara sampai permission threads_keyword_search disetujui Meta. Artinya pencarian sewaktu-waktu dapat terhenti dan perlu kami sambungkan ulang; bila itu terjadi, kuota pencarian Anda tidak terpakai. Balasan otomatis langsung ke Threads baru beroperasi setelah integrasi resmi Meta rilis.",
    position: 40,
    isActive: true,
  },
  {
    category: FaqTopic.HARGA,
    question: "Apakah saya bisa mencoba layanannya secara gratis?",
    answer: "Ya. Paket Starter gratis tanpa batas waktu dan mencakup 3 kata kunci, 300 pencarian, serta 30 balasan per bulan. Anda dapat naik paket kapan saja untuk kapasitas pencarian dan kuota balasan yang lebih besar; pembayaran saat ini lewat transfer manual yang diverifikasi tim.",
    position: 50,
    isActive: true,
  },
  {
    category: FaqTopic.FITUR,
    question: "Bisakah saya mengelola lebih dari satu bisnis di satu akun?",
    answer: "Bisa. Cari Market mendukung beberapa profil bisnis dalam satu akun, dan Anda dapat berganti profil dari pemilih di dashboard tanpa keluar dan masuk lagi. Jumlah profil yang boleh dinaungi satu akun mengikuti paket Anda.",
    position: 60,
    isActive: true,
  },
];

/** Dipakai halaman publik. Jatuh ke salinan bawaan bila tabel masih kosong. */
export async function listPublicFaqs(): Promise<PublicFaq[]> {
  const rows = await prisma.faq.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true, answer: true, category: true },
  }).catch(() => []);

  if (rows.length > 0) return rows;
  return DEFAULT_FAQS.map((faq, index) => ({
    id: `default-${index}`,
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
  }));
}

export async function listFaqsForCms(): Promise<ManagedFaq[]> {
  const rows = await prisma.faq.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return rows.map(row => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    category: row.category,
    position: row.position,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createFaq(actorId: string, input: FaqInput) {
  const row = await prisma.faq.create({ data: input });
  await recordAudit({ actorId, action: "FAQ_CREATED", entityType: "Faq", entityId: row.id });
  return row.id;
}

export async function updateFaq(actorId: string, id: string, input: FaqInput) {
  const updated = await prisma.faq.updateMany({ where: { id }, data: input });
  if (!updated.count) throw new ThreadsIntegrationError("FAQ_NOT_FOUND", "Pertanyaan tidak ditemukan.", 404);
  await recordAudit({ actorId, action: "FAQ_UPDATED", entityType: "Faq", entityId: id });
}

export async function deleteFaq(actorId: string, id: string) {
  const deleted = await prisma.faq.deleteMany({ where: { id } });
  if (!deleted.count) throw new ThreadsIntegrationError("FAQ_NOT_FOUND", "Pertanyaan tidak ditemukan.", 404);
  await recordAudit({ actorId, action: "FAQ_DELETED", entityType: "Faq", entityId: id });
}

/**
 * Mengisi tabel dengan salinan bawaan.
 *
 * Supaya Superadmin punya titik awal yang dapat disunting, bukan halaman CMS
 * kosong yang menyiratkan FAQ di beranda tidak ada.
 */
export async function seedDefaultFaqs(actorId: string) {
  const existing = await prisma.faq.count();
  if (existing > 0) {
    throw new ThreadsIntegrationError(
      "FAQ_ALREADY_SEEDED",
      "Daftar FAQ sudah terisi. Hapus dulu entri yang ada bila ingin memulai dari salinan bawaan.",
      409,
    );
  }
  await prisma.faq.createMany({ data: DEFAULT_FAQS });
  await recordAudit({ actorId, action: "FAQ_SEEDED", entityType: "Faq", metadata: { count: DEFAULT_FAQS.length } });
  return DEFAULT_FAQS.length;
}
