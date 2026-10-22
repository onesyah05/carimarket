import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";

/**
 * Teks halaman statis yang boleh diubah tanpa deploy.
 *
 * Yang dicakup hanya halaman bertumpu teks: Tentang Kami dan catatan di
 * halaman Harga. Beranda sengaja TIDAK ikut — isinya komponen interaktif
 * (radar, playground, kalkulator), dan menyalurkannya lewat kolom teks hanya
 * akan menurunkan kualitasnya sambil terasa seperti CMS yang utuh.
 *
 * Setiap halaman punya salinan bawaan di kode. Baris database hanya menimpa;
 * instalasi baru tampil benar tanpa perlu diisi lebih dulu.
 */

/** Slug yang dikenali. Daftar tertutup supaya CMS tidak menumbuhkan halaman hantu. */
export const STATIC_PAGE_SLUGS = ["tentang", "harga-catatan"] as const;
export type StaticPageSlug = (typeof STATIC_PAGE_SLUGS)[number];

export const staticPageSchema = z.object({
  slug: z.enum(STATIC_PAGE_SLUGS),
  title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(191),
  intro: z.string().trim().max(1_000).optional(),
  body: z.string().trim().min(20, "Isi halaman minimal 20 karakter.").max(20_000),
});

export type StaticPageInput = z.infer<typeof staticPageSchema>;

export type StaticPageContent = {
  slug: StaticPageSlug;
  title: string;
  intro: string | null;
  /** Paragraf hasil pemisahan baris kosong; heading ditandai awalan "## ". */
  body: string;
  source: "database" | "default";
  updatedAt: string | null;
  updatedByName: string | null;
};

const DEFAULTS: Record<StaticPageSlug, { title: string; intro: string; body: string }> = {
  tentang: {
    title: "Peluang yang baik dimulai dari mendengar.",
    intro: "Cari Market membantu bisnis Indonesia menemukan momen ketika produk atau layanan mereka benar-benar dibutuhkan.",
    body: [
      "## Misi kami",
      "Membuat social listening terasa praktis untuk bisnis kecil dan menengah tanpa mengorbankan kualitas percakapan atau kepercayaan pengguna.",
      "## Prinsip produk",
      "Otomasi harus menghemat waktu tanpa menghilangkan kendali. Pengguna dapat meninjau setiap draft atau mengotomatiskan balasan yang lolos aturan, sementara draft berisiko tetap ditahan.",
      "## Keterbukaan tentang batasan",
      "Pencarian lintas-akun di Threads bergantung pada persetujuan Meta untuk permission threads_keyword_search. Selama proses itu berjalan kami memakai jalur sementara yang dapat terhenti, dan kami menyebutkannya di produk alih-alih menyembunyikannya.",
    ].join("\n\n"),
  },
  "harga-catatan": {
    title: "Pembayaran diverifikasi manual",
    intro: null as unknown as string,
    body: "Upgrade dibuat sendiri dari dashboard: pilih paket dan durasi, bayar lewat transfer bank, e-wallet, atau QRIS sesuai nominal berkode unik, lalu tandai sudah membayar. Tim memverifikasi mutasi, biasanya dalam 1x24 jam kerja, dan kuota baru berlaku begitu pembayaran disetujui. Mode tinjau dulu tetap menjadi bawaan di semua paket.",
  },
};

/** Membaca satu halaman. Tidak pernah gagal karena database: bawaan selalu ada. */
export async function readStaticPage(slug: StaticPageSlug): Promise<StaticPageContent> {
  const row = await prisma.staticPage.findUnique({
    where: { slug },
    include: { updatedBy: { select: { name: true } } },
  }).catch(() => null);

  if (row) {
    return {
      slug,
      title: row.title,
      intro: row.intro,
      body: row.body,
      source: "database",
      updatedAt: row.updatedAt.toISOString(),
      updatedByName: row.updatedBy?.name ?? null,
    };
  }

  const fallback = DEFAULTS[slug];
  return {
    slug,
    title: fallback.title,
    intro: fallback.intro ?? null,
    body: fallback.body,
    source: "default",
    updatedAt: null,
    updatedByName: null,
  };
}

export async function listStaticPagesForCms(): Promise<StaticPageContent[]> {
  return Promise.all(STATIC_PAGE_SLUGS.map(slug => readStaticPage(slug)));
}

export async function saveStaticPage(actorId: string, input: StaticPageInput) {
  await prisma.staticPage.upsert({
    where: { slug: input.slug },
    update: { title: input.title, intro: input.intro ?? null, body: input.body, updatedById: actorId },
    create: { slug: input.slug, title: input.title, intro: input.intro ?? null, body: input.body, updatedById: actorId },
  });
  await recordAudit({ actorId, action: "STATIC_PAGE_UPDATED", entityType: "StaticPage", entityId: input.slug });
}

/** Mengembalikan halaman ke salinan bawaan di kode. */
export async function resetStaticPage(actorId: string, slug: StaticPageSlug) {
  await prisma.staticPage.deleteMany({ where: { slug } });
  await recordAudit({ actorId, action: "STATIC_PAGE_RESET", entityType: "StaticPage", entityId: slug });
}

/**
 * Memecah isi halaman menjadi blok yang dapat dirender.
 *
 * Formatnya sengaja sesederhana mungkin: baris kosong memisahkan paragraf, dan
 * awalan "## " menandai subjudul. Tanpa HTML bebas, teks dari CMS tidak pernah
 * menjadi jalan masuk skrip ke halaman publik.
 */
export function parseStaticBody(body: string): Array<{ kind: "heading" | "paragraph"; text: string }> {
  return body
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => block.startsWith("## ")
      ? { kind: "heading" as const, text: block.slice(3).trim() }
      : { kind: "paragraph" as const, text: block.replace(/\s*\n\s*/g, " ") });
}
