import { PrismaClient, Role, AccountStatus, ReplyMode, AdminPermissionKey, ArticleStatus } from "@prisma/client";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

// Kata sandi dev untuk seluruh akun fiktif: "carimarket123" (hanya untuk lokal, dokumentasi di README).
const DEV_PASSWORD = "carimarket123";

async function devPasswordHash() {
  const salt = randomBytes(16);
  const derived = await scryptAsync(DEV_PASSWORD.normalize("NFKC"), salt, 64);
  return `scrypt:${salt.toString("base64")}:${derived.toString("base64")}`;
}

const SEED_ARTICLES = [
  {
    slug: "cara-menemukan-lead-berkualitas-di-threads",
    title: "Cara menemukan lead berkualitas di Threads tanpa terasa seperti spam",
    category: "Panduan",
    tags: ["threads", "lead", "panduan"],
    excerpt: "Kerangka sederhana untuk membaca niat beli, menyaring percakapan, dan merespons dengan konteks.",
    status: ArticleStatus.PUBLISHED,
    authorEmail: "superadmin@carimarket.id",
    content: `Di Threads, permintaan sering muncul sebagai pertanyaan sederhana: meminta rekomendasi, membandingkan pilihan, atau mencari vendor yang tersedia. Nilainya bukan pada jumlah penyebutan kata kunci, tetapi pada konteks di balik percakapan.

## Mulai dari niat, bukan sekadar kata

Kata kunci membantu menemukan kandidat, tetapi niat membeli terlihat dari cara seseorang menjelaskan kebutuhan, lokasi, waktu, dan batasannya. Prioritaskan postingan yang cukup spesifik untuk Anda jawab dengan relevan, dan simpan kata kunci negatif untuk menyaring hal yang tidak pernah Anda layani.

## Respons yang baik memberi nilai lebih dulu

Jangan membuka percakapan dengan penawaran generik. Akui kebutuhan yang disampaikan, jawab bagian yang bisa Anda bantu, lalu berikan langkah berikutnya yang ringan. Draft balasan sebaiknya menjadi titik awal yang Anda tinjau, bukan keputusan akhir yang dikirim mentah-mentah.

## Jaga ritme dan reputasi

Mulai dengan mode tinjau untuk memahami kualitas draft. Saat beralih ke otomatis, gunakan ambang relevansi, batas harian, jeda kirim, dan tahan draft berisiko agar ritme tetap wajar di mata pengguna Threads maupun sistem moderasinya.`,
  },
  {
    slug: "social-listening-untuk-bisnis-lokal",
    title: "Social listening untuk bisnis lokal: mulai dari percakapan yang dekat",
    category: "Strategi",
    tags: ["social-listening", "bisnis-lokal"],
    excerpt: "Ubah percakapan publik menjadi sinyal permintaan yang relevan untuk area layanan Anda.",
    status: ArticleStatus.PUBLISHED,
    authorEmail: "superadmin@carimarket.id",
    content: `Bisnis lokal tidak bersaing dengan seluruh internet. Ia bersaing dengan percakapan yang terjadi di sekitar area layanannya. Social listening yang fokus membuat pemilik bisnis melihat permintaan sebelum calon pelanggan sempat bertanya ke mana-mana.

## Pilih sinyal yang dekat dengan layanan

Untuk jasa di area tertentu, kombinasi kata kunci layanan dan nama wilayah jauh lebih berguna daripada istilah umum. Tambahkan kata kunci negatif seperti nama kompetisi atau topik yang berbeda makna agar daftar lead tetap bersih.

## Ukur kualitas, bukan hanya jumlah

Sepuluh percakapan yang relevan lebih berharga daripada seratus penyebutan samar. Perhatikan skor relevansi dan alasan kecocokan pada setiap lead, lalu perbaiki kata kunci Anda dari pola yang benar-benar menghasilkan percakapan.

## Tutup percakapan dengan cara yang manusiawi

Balasan yang baik menyebut konteks postingan, menjawab pertanyaan, dan menawarkan langkah lanjutan yang mudah. Reputasi bisnis lokal dibangun dari konsistensi, bukan dari jumlah balasan yang dikirim sehari.`,
  },
  {
    slug: "menulis-balasan-promosi-yang-manusiawi",
    title: "Menulis balasan promosi yang manusiawi dan layak ditanggapi",
    category: "Copywriting",
    tags: ["copywriting", "balasan"],
    excerpt: "Tiga pola balasan yang sopan, spesifik, dan tetap memberi ruang bagi calon pelanggan.",
    status: ArticleStatus.DRAFT,
    authorEmail: "admin@carimarket.id",
    content: `Balasan promosi gagal bukan karena mempromosikan, tetapi karena mengabaikan konteks orang yang menulis postingan. Tiga pola berikut menjaga balasan tetap layak ditanggapi.

## Akui konteksnya lebih dulu

Mulai dari detail yang disebut penulis postingan: kebutuhan, tanggal, wilayah, atau kendala. Satu kalimat yang menunjukkan Anda membaca lebih berharga daripada paragraf tentang keunggulan bisnis.

## Jawab bagian yang bisa Anda bantu

Sampaikan dengan jelas apa yang Anda kerjakan dan untuk siapa. Hindari klaim absolut seperti paling murah atau pasti berhasil yang justru menurunkan kepercayaan dan berisiko ditandai aturan kepatuhan.

## Beri langkah berikutnya yang ringan

Akhiri dengan ajakan yang mudah dipenuhi: bertukar pesan, mengirim contoh hasil, atau memberi estimasi awal. Calon pelanggan yang diberi ruang akan membalas; calon pelanggan yang dibentak penawaran akan mengabaikan.`,
  },
];

async function main() {
  const passwordHash = await devPasswordHash();

  await prisma.plan.upsert({
    where: { code: "STARTER" },
    update: {},
    create: {
      code: "STARTER",
      name: "Starter",
      monthlyPrice: 0,
      monthlySearchLimit: 100,
      monthlyReplyLimit: 20,
      keywordLimit: 3,
    },
  });

  await prisma.user.upsert({
    where: { email: "nadia@langitvisual.id" },
    update: { passwordHash },
    create: {
      email: "nadia@langitvisual.id",
      name: "Nadia Pratama",
      passwordHash,
      role: Role.USER,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      businessProfile: {
        create: {
          name: "Langit Visual",
          category: "Jasa Drone",
          description: "Dokumentasi udara untuk properti, acara, dan konstruksi.",
          location: "Jakarta",
          serviceArea: "Jabodetabek",
          brandVoice: "Ramah dan profesional",
          onboardingCompletedAt: new Date(),
        },
      },
      replyAutomation: {
        create: {
          mode: ReplyMode.REVIEW_FIRST,
          minimumScore: 90,
          dailyLimit: 10,
          delayMinutes: 15,
          pauseOnRisk: true,
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@carimarket.id" },
    update: { passwordHash },
    create: {
      email: "admin@carimarket.id",
      name: "Raka Admin",
      passwordHash,
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      adminPermissions: {
        create: [
          { permission: AdminPermissionKey.SUPPORT_READ },
          { permission: AdminPermissionKey.SUPPORT_REPLY },
          { permission: AdminPermissionKey.MODERATION_REVIEW },
          { permission: AdminPermissionKey.CONTENT_DRAFT },
        ],
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "superadmin@carimarket.id" },
    update: { passwordHash },
    create: {
      email: "superadmin@carimarket.id",
      name: "Ayu Putri",
      passwordHash,
      role: Role.SUPERADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  const authors = new Map(
    (await prisma.user.findMany({ where: { email: { in: SEED_ARTICLES.map(article => article.authorEmail) } } })).map(user => [user.email, user.id]),
  );

  for (const [index, seedArticle] of SEED_ARTICLES.entries()) {
    const authorId = authors.get(seedArticle.authorEmail);
    if (!authorId) continue;
    const category = await prisma.category.upsert({
      where: { name: seedArticle.category },
      update: {},
      create: { name: seedArticle.category, slug: seedArticle.category.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
    });
    const article = await prisma.article.upsert({
      where: { slug: seedArticle.slug },
      update: {
        title: seedArticle.title,
        excerpt: seedArticle.excerpt,
        content: seedArticle.content,
        categoryId: category.id,
        authorId,
        status: seedArticle.status,
        publishedAt: seedArticle.status === ArticleStatus.PUBLISHED ? new Date(Date.now() - (index + 1) * 6 * 86_400_000) : null,
      },
      create: {
        slug: seedArticle.slug,
        title: seedArticle.title,
        excerpt: seedArticle.excerpt,
        content: seedArticle.content,
        categoryId: category.id,
        authorId,
        status: seedArticle.status,
        metaTitle: seedArticle.title,
        metaDescription: seedArticle.excerpt,
        publishedAt: seedArticle.status === ArticleStatus.PUBLISHED ? new Date(Date.now() - (index + 1) * 6 * 86_400_000) : null,
      },
    });
    for (const tagName of seedArticle.tags) {
      const tag = await prisma.tag.upsert({
        where: { name: tagName },
        update: {},
        create: { name: tagName, slug: tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
      });
      await prisma.articleTag.upsert({
        where: { articleId_tagId: { articleId: article.id, tagId: tag.id } },
        update: {},
        create: { articleId: article.id, tagId: tag.id },
      });
    }
  }
}

main()
  .finally(async () => prisma.$disconnect());
