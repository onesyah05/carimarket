# Product Requirements Document (PRD)

## Cari Market — Platform Pencarian Lead Bisnis di Threads

**Versi:** 1.2 (Draft) **Tanggal:** 29 September 2026 **Status:** Draft — keputusan arsitektur Next.js tunggal dan MySQL telah ditetapkan

---

## 1. Ringkasan Produk

Cari Market adalah platform SaaS yang membantu pemilik bisnis menemukan calon pelanggan (lead) dari postingan publik di Threads yang relevan, lalu merespons dengan mode yang dapat dipilih: tinjau setiap draft terlebih dahulu atau kirim otomatis dengan aturan keamanan.

**Contoh use case:** Pemilik jasa drone mendaftar, mengatur kata kunci ("jasa drone", "sewa drone", "foto udara"), sistem menampilkan postingan Threads terbaru yang cocok, lalu pemilik bisnis membalas postingan tersebut dengan promosi jasanya.

---

## 2. Latar Belakang & Masalah yang Diselesaikan

- Pemilik bisnis kecil/menengah kesulitan memantau percakapan publik yang relevan dengan bisnisnya di media sosial secara manual.
- Mencari lead secara manual di Threads memakan waktu dan tidak konsisten.
- Dibutuhkan alat yang mengotomatiskan **pencarian**, namun tetap menjaga kualitas **respons** agar tidak terkesan spam.

---

## 3. Tujuan Produk

1. Memudahkan pemilik bisnis menemukan postingan Threads yang relevan dengan kata kunci bisnis mereka.
2. Menyediakan alur respons yang dapat dikonfigurasi per workspace: **Tinjau dulu** sebagai pilihan awal atau **Balas otomatis** dengan ambang relevansi, jeda pengiriman, batas harian, dan fallback ke review.
3. Memberi platform admin kontrol penuh atas kualitas, kuota, dan kepatuhan penggunaan.

---

## 4. Ketergantungan Teknis Penting

> ⚠️ **Catatan kritikal:** Fitur pencarian lintas-akun (mencari postingan milik siapa pun di Threads) baru berfungsi penuh setelah aplikasi disetujui Meta untuk permission `threads_keyword_search` melalui proses App Review. Selama masa review (estimasi 3–4 minggu), pencarian hanya berlaku untuk akun Threads milik user itu sendiri. Roadmap MVP perlu mengakomodasi kondisi ini (lihat Bagian 9).

---

## 5. Definisi Role Pengguna

| Role | Deskripsi Singkat | Jumlah Tipikal |
| --- | --- | --- |
| **Superadmin** | Pemilik/pengelola tertinggi platform. Kontrol penuh atas sistem, admin lain, dan seluruh user. | 1–2 orang (internal) |
| **Admin** | Staf operasional platform yang membantu Superadmin menjalankan operasional harian: dukungan user, moderasi konten, monitoring kepatuhan. Tidak bisa mengubah pengaturan sistem kritikal. | Beberapa orang (internal) |
| **User** | Pemilik bisnis yang menggunakan platform untuk mencari lead dan mengelola balasan promosi di Threads. | Tidak terbatas (pelanggan) |

---

## 6. Menu & Fitur per Role

### 6.1 Superadmin

**Dashboard**

- Ringkasan metrik platform: total user aktif, total pencarian dilakukan, total komentar terkirim, status kuota API global
- Grafik pertumbuhan user & penggunaan dari waktu ke waktu

**Manajemen Admin**

- Tambah/hapus akun Admin
- Atur hak akses (permission) tiap Admin
- Lihat log aktivitas Admin (audit trail)

**Manajemen User**

- Lihat seluruh daftar user, detail profil bisnis, status akun (aktif/suspend)
- Suspend/aktifkan akun user
- Reset akses/token Threads user jika bermasalah

**Manajemen Paket & Billing**

- Buat/edit paket langganan (Free, Pro, Enterprise) beserta batas kuota pencarian & komentar per paket
- Lihat riwayat transaksi & invoice seluruh user
- Atur harga & promo

**Manajemen Kuota API**

- Monitor pemakaian kuota `keyword_search` (batas 2.200 query/24 jam per akun Threads yang terhubung)
- Atur alokasi kuota per paket/user
- Lihat status token Threads API (expired, revoked, error) di seluruh user

**Kepatuhan & Moderasi**

- Review sampel komentar yang dihasilkan sistem AI untuk deteksi pola spam
- Kelola daftar kata kunci terlarang (blacklist)
- Kelola template etika/disclaimer komentar
- Tinjau laporan (report) dari user Threads lain jika ada keluhan terkait akun yang pakai platform ini

**Pengaturan Sistem**

- Konfigurasi kredensial Threads App (App ID, App Secret, redirect URL)
- Konfigurasi integrasi AI (model, prompt template untuk generate komentar)
- Pengaturan notifikasi sistem (email, push)

**Audit Log**

- Log seluruh aktivitas kritikal di platform (perubahan billing, suspend user, perubahan permission)

**Manajemen Konten (CMS) — Marketing Site**

- CRUD artikel blog (judul, konten, gambar, kategori, tag, meta title/description untuk SEO)
- Jadwalkan publish artikel
- Kelola halaman statis (Landing Page, About Us, Pricing) — minimal bisa edit teks/gambar tanpa perlu deploy ulang
- Kelola FAQ yang tampil di landing page

---

### 6.2 Admin

**Dashboard**

- Ringkasan tiket dukungan yang perlu ditangani
- Ringkasan konten yang perlu direview (flagged)

**Dukungan User (Support)**

- Lihat & balas tiket bantuan dari user
- Lihat detail akun user (read-only, tanpa akses billing/kredensial sensitif)
- Bantu reset password/akses user (dengan approval, bukan akses langsung ke token Threads)

**Moderasi Konten**

- Review antrian komentar yang ditandai sistem sebagai berpotensi melanggar (mengandung kata sensitif, terlalu berulang, dsb)
- Setujui/tolak/edit komentar yang ditandai
- Tandai user yang berulang kali melanggar kebijakan untuk eskalasi ke Superadmin

**Monitoring Kepatuhan**

- Pantau dashboard rate limit & error API secara umum (read-only)
- Laporkan anomali ke Superadmin

**Bantu Kelola Konten Blog**

- Buat/edit draft artikel blog
- Draft menunggu approval Superadmin sebelum publish (Admin tidak bisa publish langsung)

**Catatan:** Admin **tidak** memiliki akses ke: pengaturan billing, kredensial App Threads, kemampuan suspend/hapus akun user secara permanen, dan pengaturan sistem inti.

---

### 6.3 User (Pemilik Bisnis)

**Onboarding**

- Registrasi akun & verifikasi email
- Hubungkan akun Threads (OAuth)
- Isi profil bisnis: nama bisnis, kategori, deskripsi singkat, area layanan/lokasi

**Dashboard**

- Ringkasan: jumlah lead baru ditemukan, jumlah komentar terkirim, sisa kuota bulan ini

**Pengaturan Kata Kunci**

- Tambah/edit/hapus kata kunci pencarian bisnis
- Tambah kata kunci negatif (exclude)
- Atur frekuensi pencarian (mis. tiap 1 jam, tiap hari)

**Lead Feed (Pencarian)**

- Daftar postingan Threads terbaru yang cocok dengan kata kunci, diurutkan berdasarkan relevansi/waktu
- Filter: rentang waktu, tingkat engagement minimum, status (belum/sudah dikomentari)
- Lihat detail postingan (isi, penulis, waktu, link)

**Balasan/Komentar**

- Draft komentar otomatis dari AI berdasarkan profil bisnis & isi postingan
- Edit draft sebelum kirim
- Kirim komentar sesuai mode workspace: tinjau dulu atau otomatis terkontrol dengan ambang relevansi, batas harian, jeda, dan fallback ke tinjauan
- Jadwalkan pengiriman (delay, batas jumlah komentar/hari agar tidak terkesan bot)

**Riwayat**

- Log seluruh komentar yang sudah dikirim beserta statusnya (terkirim/gagal/dihapus)
- Notifikasi jika ada balasan balik dari pemilik postingan asli (potensi lead hangat)

**Akun & Langganan**

- Kelola profil bisnis
- Lihat paket langganan aktif & sisa kuota
- Upgrade/downgrade paket
- Kelola notifikasi (email/push)

---

## 7. Alur Pengguna Utama (User Flow Ringkas)

1. User mendaftar → hubungkan akun Threads → isi profil bisnis
2. User atur kata kunci pencarian
3. Sistem menjalankan pencarian berkala sesuai jadwal
4. Postingan yang cocok muncul di Lead Feed
5. Sistem membuat draft komentar otomatis untuk tiap lead
6. Sistem mengikuti mode workspace: user meninjau draft terlebih dahulu, atau draft yang lolos aturan dijadwalkan otomatis
7. Komentar tercatat di riwayat, user dapat notifikasi jika ada respons balik

---

## 8. Batasan & Risiko yang Perlu Diperhatikan

- **Ketergantungan App Review Meta**: fitur pencarian lintas-akun tidak berfungsi penuh sebelum approval `threads_keyword_search`.
- **Rate limit**: 2.200 query/24 jam berlaku per akun Threads yang terhubung — perlu strategi alokasi kuota yang adil antar user jika banyak user berbagi App yang sama.
- **Risiko kebijakan platform**: komentar promosi otomatis berisiko dianggap spam oleh sistem deteksi Threads/Meta. Mode `Tinjau dulu` menjadi default, sedangkan mode otomatis wajib memakai batas harian, jeda, ambang relevansi, dan fallback ke review.
- **Privasi data**: perlu Privacy Policy & mekanisme penghapusan data yang jelas (syarat wajib App Review).

---

## 9. Roadmap Bertahap (Disesuaikan dengan Status App Review)

**Fase 1 — Sebelum App Review Approved**

- Onboarding, profil bisnis, pengaturan kata kunci
- Dashboard & struktur role (Superadmin, Admin, User)
- Riwayat & pengaturan akun
- Pencarian terbatas ke akun sendiri (untuk testing internal)

**Fase 2 — Setelah `threads_keyword_search` Approved**

- Lead Feed penuh (pencarian lintas-akun publik)
- Draft komentar AI otomatis
- Sistem pengiriman komentar dengan pilihan tinjau dulu atau otomatis terkontrol

**Fase 3 — Pengembangan Lanjutan**

- Analitik lanjutan (conversion tracking, performa kata kunci)
- Manajemen paket & billing otomatis

---

## 10. Tech Stack

| Layer | Teknologi | Catatan |
| --- | --- | --- |
| Aplikasi web | **Next.js App Router + TypeScript** | Satu proyek untuk halaman publik, autentikasi, dashboard User/Admin/Superadmin, Route Handlers, dan operasi server. Halaman publik memakai SSR/SSG; halaman privat memakai Server Components/Client Components sesuai kebutuhan. |
| UI | React + Tailwind CSS | Komponen domain reusable ditempatkan di `src/features/`; halaman/rute dijaga tipis. |
| Data access | **Prisma ORM** | Satu lapisan akses data server-only di `src/server/`; Prisma Client tidak boleh dipanggil langsung dari komponen client. |
| Database | **MySQL 8.x** | Satu-satunya database relasional resmi. Gunakan InnoDB, charset `utf8mb4`, migration Prisma, nilai uang `Decimal`, enum eksplisit, dan timestamp UTC. |
| Job Queue / Scheduler | Node.js (mis. BullMQ + Redis) | Untuk pencarian keyword berkala, notifikasi, dan pengiriman komentar terjadwal; integrasi dibuat adapter-based agar aplikasi lokal tetap dapat berjalan tanpa Redis. |
| Autentikasi | Session-based auth; OAuth Threads terpisah per user | Role dan otorisasi divalidasi di server. Access/refresh token Threads wajib dienkripsi saat tersimpan dan tidak pernah masuk log. |

### 10.1 Keputusan Arsitektur Aplikasi

- Marketing site, autentikasi, dashboard seluruh role, API/Route Handlers, dan pekerjaan server berada dalam **satu proyek Next.js App Router**. Tidak ada aplikasi Express atau React/Vite terpisah untuk MVP.
- Batas domain dipertahankan melalui `src/features/` untuk UI/logic domain reusable dan `src/server/` untuk database, autentikasi, integrasi, job, serta operasi sensitif.
- Seluruh pemeriksaan role (`SUPERADMIN`, `ADMIN`, `USER`) dan kepemilikan resource dilakukan di server; penyembunyian menu di UI bukan kontrol akses.
- Integrasi Threads, AI, billing, email, dan queue berada di balik adapter dan environment variable. Kredensial yang belum tersedia tidak boleh mencegah pengembangan lokal yang deterministik.

### 10.2 Ringkasan Model Data MySQL

Skema dinormalisasi dan dikelola hanya melalui Prisma schema serta Prisma migration. Entitas minimum berikut menjadi acuan implementasi:

| Domain | Entitas utama | Relasi/aturan penting |
| --- | --- | --- |
| Identitas & akses | `User`, `Account`/`Session`, `AdminPermission` | `User.email` unik dan ternormalisasi; role enum `SUPERADMIN`, `ADMIN`, `USER`; status akun eksplisit. Permission Admin terkait ke user ber-role Admin dan unik per pasangan user-permission. |
| Bisnis | `Business` | Dimiliki User; nama, kategori, deskripsi, lokasi/area layanan. Semua query bisnis wajib memeriksa kepemilikan atau hak Admin/Superadmin. |
| Threads OAuth | `ThreadsConnection` | Satu atau lebih koneksi per User sesuai kebutuhan produk; pasangan provider-account ID unik. Access token dan refresh token disimpan sebagai ciphertext beserta metadata expiry/status, bukan plaintext. |
| Pencarian | `Keyword`, `SearchRun`, `Lead` | Keyword terkait Business dan memiliki tipe include/exclude, status, serta jadwal. Lead menyimpan ID post Threads eksternal yang unik per koneksi/sumber, snapshot publik seperlunya, waktu post, skor relevansi, dan status pipeline. |
| Draft & komentar | `ReplyDraft`, `Comment`, `ReplyAutomationSetting` | Draft terkait Lead dan Business; simpan teks hasil AI, teks edit user, versi/status moderasi, mode pengiriman, serta approver. Pengaturan workspace menyimpan mode, ambang relevansi, batas harian, jeda, dan aturan penahanan risiko. Comment hanya dapat dikirim dari draft yang lolos aturan mode aktif, dengan status pengiriman dan error aman tanpa token/secret. |
| Kuota | `QuotaUsage`, `ApiUsageEvent` | Agregasi pemakaian per User/koneksi/periode dan event penggunaan yang dapat diaudit. Kombinasi owner, jenis kuota, dan periode unik untuk mencegah hitung ganda. |
| Paket & billing | `Plan`, `Subscription`, `Invoice`, `Payment` | Harga memakai Prisma `Decimal`, currency kode eksplisit, provider reference unik bila tersedia, dan status billing berupa enum. Satu subscription aktif efektif per User; histori invoice/payment dipertahankan. |
| Moderasi & kepatuhan | `ModerationCase`, `BlacklistTerm`, `UserReport` | Menyimpan alasan, status, reviewer, keputusan, dan timestamp. Bukti/snapshot tidak boleh menyimpan secret atau data pribadi yang tidak diperlukan. |
| CMS | `Article`, `Category`, `Tag`, tabel relasi artikel-tag, `StaticPage`, `Faq` | Slug unik; status draft/review/scheduled/published; `publishedAt` diperlukan untuk konten published; Admin tidak dapat publish tanpa approval Superadmin. |
| Dukungan & notifikasi | `SupportTicket`, `SupportMessage`, `Notification`, `NotificationPreference` | Ticket memiliki requester, assignee opsional, status, priority, dan thread pesan. Notifikasi memiliki status baca/kirim; preferensi unik per user dan channel. |
| Audit | `AuditLog` | Actor, action, target type/ID, metadata aman, IP/user-agent bila sah diperlukan, dan timestamp. Audit kritikal bersifat append-only dari aplikasi. |

### 10.3 Constraint, Indeks, dan Retensi

- Semua foreign key dan field pencarian rutin wajib diindeks, khususnya `userId`, `businessId`, `threadsConnectionId`, `keywordId`, `leadId`, `status`, `createdAt`, `scheduledAt`, `publishedAt`, dan external provider ID.
- Gunakan composite unique constraint untuk identitas bisnis yang scoped, misalnya keyword ternormalisasi per Business, pemakaian kuota per owner/type/periode, relasi artikel-tag, dan post Threads per sumber/koneksi.
- Nilai finansial memakai `Decimal` dengan precision/scale eksplisit; jangan memakai `Float`. Semua waktu disimpan sebagai UTC dan dikonversi ke zona pengguna saat ditampilkan.
- Data operasional menggunakan soft delete (`deletedAt`) bila histori/audit harus dipertahankan. Penghapusan parent sensitif menggunakan `Restrict` atau prosedur penghapusan data terkontrol; `Cascade` hanya untuk data anak yang benar-benar tidak bermakna tanpa parent, seperti join table atau session.
- Penghapusan User harus menjalankan alur penghapusan data: revoke koneksi bila memungkinkan, hapus/anonimkan data pribadi sesuai kebijakan, tetapi pertahankan catatan finansial/audit yang diwajibkan dengan identitas diminimalkan.
- Ciphertext token, key version/IV/auth tag, dan metadata expiry boleh disimpan; plaintext token, App Secret, API key, password, dan payload rahasia dilarang disimpan di log, audit metadata, maupun error message.
- Constraint lintas-baris yang tidak dapat dijamin MySQL/Prisma secara deklaratif—misalnya satu subscription aktif efektif atau transisi status draft-ke-comment—wajib dijaga dengan transaksi database dan validasi service server-side.
- Migration dan seed harus MySQL-compatible. Seed hanya memuat data fiktif untuk development dan tidak boleh berisi token/kredensial nyata.

---

## 11. Halaman Publik (Marketing Site) & Kebutuhan SEO

### 11.1 Daftar Halaman Publik

**Landing Page (Beranda)**

- Hero section: value proposition singkat ("Temukan pelanggan baru dari percakapan publik di Threads")
- Penjelasan cara kerja produk (3-4 langkah singkat)
- Daftar fitur utama
- Contoh use case per industri (jasa drone, dsb — bisa beberapa kategori)
- Testimoni/social proof (jika sudah ada)
- Daftar paket harga ringkas + CTA daftar
- FAQ singkat
- Footer dengan link ke Blog, About Us, Privacy Policy, Terms of Service, Kontak

**Halaman Harga (Pricing)**

- Detail perbandingan tiap paket & kuota
- CTA daftar/upgrade

**Blog**

- Listing artikel (dengan pagination/kategori/tag)
- Halaman detail artikel
- Tujuan: konten edukasi seputar social listening, tips promosi di Threads, studi kasus — mendukung SEO organik jangka panjang
- Butuh sistem CMS sederhana (bisa headless CMS atau dibuat custom di dashboard Superadmin/Admin untuk kelola artikel)

**About Us**

- Cerita/latar belakang produk, misi, tim (opsional)

**Kontak**

- Form kontak/dukungan untuk calon pelanggan yang belum mendaftar

**Halaman Legal**

- Privacy Policy
- Terms of Service
- Halaman/instruksi Penghapusan Data (syarat wajib App Review Meta yang sudah dibahas sebelumnya)

### 11.2 Kebutuhan SEO Teknis

- **Rendering**: SSR/SSG (via Next.js) untuk semua halaman publik di atas, agar konten terindeks sempurna oleh mesin pencari
- **Meta tag dinamis**: title, description, Open Graph, Twitter Card per halaman (terutama tiap artikel blog)
- **Structured data (JSON-LD)**: schema Organization, Article (untuk blog), FAQ (untuk bagian FAQ), Product/Pricing jika relevan
- **Sitemap.xml & robots.txt** otomatis ter-generate
- **URL slug** yang bersih dan deskriptif (mis. `/blog/cara-cari-lead-di-threads`, bukan `/blog?id=123`)
- **Performa**: optimasi Core Web Vitals (lazy load gambar, minimasi JS di halaman publik, caching SSG untuk halaman yang jarang berubah seperti Landing Page/About Us)
- **Mobile-friendly** & responsive (wajib, karena sebagian besar traffic organik dari pencarian mobile)
- **Internal linking** yang baik antara blog dan landing page/pricing untuk distribusi otoritas halaman

### 11.3 Kepemilikan Konten

- Superadmin/Admin memerlukan menu tambahan untuk **kelola konten blog** (CRUD artikel, kategori, upload gambar, jadwal publish) — ini perlu ditambahkan ke menu Superadmin/Admin di Bagian 6 sebagai modul **"Manajemen Konten (CMS)"**.

---

## 12. Hal yang Masih Perlu Diputuskan

- Model bisnis: berapa tier paket & batas kuota masing-masing?
- Aturan risiko apa saja yang wajib selalu menahan draft meskipun mode otomatis aktif?
- Siapa yang akan mengisi konten blog secara rutin, dan seberapa sering publish artikel baru?
