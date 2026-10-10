# Cari Market

Satu aplikasi Next.js untuk marketing site, onboarding, dashboard pengguna, operasi admin, dan kontrol superadmin. Database menggunakan MySQL melalui Prisma.

## Menjalankan lokal

```bash
cp .env.example .env
docker compose up -d mysql
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Buka `http://localhost:3000`. Tanpa kredensial Threads, halaman pengaturan menampilkan status belum terkonfigurasi dan tidak mengirim komentar ke platform eksternal.

## Akun dev (data fiktif)

Setelah `npm run db:seed`, masuk lewat `/masuk` menggunakan salah satu akun berikut dengan kata sandi `carimarket123`:

| Email | Role | Keterangan |
| --- | --- | --- |
| `superadmin@carimarket.id` | SUPERADMIN | Kontrol penuh platform |
| `admin@carimarket.id` | ADMIN | Staf operasional |
| `nadia@langitvisual.id` | USER | Workspace bisnis "Langit Visual" |

Kata sandi ini hanya untuk pengembangan lokal; ganti sebelum dipakai di lingkungan lain.

## Migration database

Skema dikelola lewat Prisma migration di `prisma/migrations/`.

```bash
npm run db:migrate   # pengembangan: membuat dan menerapkan migration baru
npm run db:deploy    # staging/produksi: menerapkan migration yang sudah ada
```

Database yang sebelumnya dibuat dengan `npm run db:push` perlu di-baseline satu
kali agar migration awal tidak dijalankan ulang di atas tabel yang sudah ada:

```bash
npx prisma migrate resolve --applied 0_init
npm run db:deploy
```

`npm run db:push` tetap tersedia untuk eksperimen cepat, tetapi perubahan skema
yang dipakai bersama harus lewat migration.

## Validasi

```bash
npm run lint
npm run typecheck
npm test
npm run db:validate
npm run build
```

> Catatan dependensi: npm 11.x gagal dengan `Cannot read properties of null (reading 'edgesOut')` saat memasang Vitest 4.1.11 karena bug resolver peer. Bila versi Vitest dinaikkan, jalankan sekali `npm install --legacy-peer-deps` untuk membuat lockfile-nya; setelah itu `npm install` dan `npm ci` biasa kembali bekerja normal.

`npm test` menjalankan Vitest untuk logika murni: pencocokan kata kunci, jam
tenang, perhitungan kuota, rate limit, dan guard pengalihan. Pengujian tidak
membutuhkan MySQL maupun kredensial Threads.

## Deploy ke server dengan aaPanel

Panduan ini memakai aaPanel (panel VPS populer) untuk men-deploy Cari Market sebagai aplikasi Next.js produksi di atas MySQL 8.

### Prasyarat

- VPS dengan aaPanel terpasang (pasang via `curl -sSL https://www.aapanel.com/script/install_7.0_en.sh -o install.sh && bash install.sh aapanel`).
- Node.js versi 20 atau lebih baru.
- Domain atau subdomain yang sudah diarahkan (A record) ke IP VPS.

### 1. Instal software stack

Buka aaPanel → **App Store**, lalu pasang:

- **Nginx** (versi stabil apa pun) sebagai reverse proxy.
- **MySQL 8.x** (atau 5.7 bila 8.x bermasalan di server Anda; Prisma mendukung keduanya).

Lalu pasang Node.js melalui **App Store → Node.js Version Manager** (pilih v20 LTS, set sebagai default), atau manual:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Buat database

aaPanel → **Databases → Add Database**:

- Database name: `carimarket`
- Username: `carimarket`
- Password: gunakan password kuat yang dihasilkan aaPanel (jangan `change-me`)
- Access permission: **Local server** saja untuk produksi

Catat kredensialnya — akan diisi ke `DATABASE_URL`.

### 3. Clone dan build aplikasi

```bash
cd /www/wwwroot
git clone https://github.com/onesyah05/carimarket.git
cd carimarket
cp .env.example .env
nano .env
```

Isi `.env` untuk produksi:

```ini
DATABASE_URL="mysql://carimarket:PASSWORD_KUAT@127.0.0.1:3306/carimarket"
NEXT_PUBLIC_APP_URL="https://domain-anda.com"
APP_ENCRYPTION_KEY="" # generate dengan: openssl rand -base64 32
THREADS_APP_ID=""
THREADS_APP_SECRET=""
THREADS_GRAPH_URL="https://graph.threads.net/v1.0"
AI_API_KEY=""
THREADS_SIGNUP_ENABLED="true"
INTEGRATION_MODE="live"
WORKER_ENABLED="true"
WORKER_INTERVAL_MS="60000"
```

> Wajib: `APP_ENCRYPTION_KEY` harus 32 byte (output `openssl rand -base64 32` tepat 32 byte). Simpan backup kunci ini — tanpanya token Threads terenkripsi tidak bisa didekripsi.

Build dan siapkan database:

```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run build
```

### 4. Jalankan aplikasi dengan PM2

```bash
npm install -g pm2
PORT=3000 pm2 start "npm run start" --name carimarket
pm2 save
pm2 startup
```

Pastikan port 3000 tidak terbuka untuk publik; akses hanya lewat Nginx di langkah berikut.

### 5. Konfigurasi reverse proxy di aaPanel

aaPanel → **Website → Add Site**:

- Domain: `domain-anda.com`
- Root directory: `/www/wwwroot/carimarket/public`
- PHP version: **Pure static** / tidak perlu PHP
- Database: tidak perlu (sudah dibuat manual)

Buka **Site settings → Reverse Proxy → Add Reverse Proxy**:

- Proxy name: `carimarket`
- Target URL: `http://127.0.0.1:3000`
- Send Domain: `$host`

### 6. Aktifkan SSL

**Site settings → SSL → Let's Encrypt** → pilih domain → **Apply**. Nyalakan **Force HTTPS**.

> Callback OAuth Threads butuh HTTPS dan harus sama persis dengan `NEXT_PUBLIC_APP_URL` + `/api/integrations/threads/callback`. Daftarkan URL callback produksi tersebut di Meta App Dashboard sebelum menghubungkan akun.

### 7. Perbarui aplikasi

```bash
cd /www/wwwroot/carimarket
git pull
npm install
npm run db:generate
npm run db:deploy
npm run build
pm2 restart carimarket
```

### Catatan produksi

- **Worker latar**: berjalan di dalam proses Next.js (`instrumentation.ts`), jadi `pm2 restart` juga me-restart worker. Untuk beban banyak pengguna, pisahkan ke proses cron/worker terpisah yang memanggil fungsi di `src/server/jobs/`.
- **Backup**: aktifkan **Cron** di aaPanel untuk backup database MySQL berkala (`/backup` aaPanel).
- **Keamanan**: tutup port 3306 dan 3000 di **Security** panel; hanya buka 80/443/22.
- **Ganti kata sandi dev**: semua akun seed memakai `carimarket123`. Setelah login, ganti kata sandi setiap akun di Pengaturan → Keamanan, atau hapus akun seed untuk produksi.
- **Firewall aplikasi**: tambahkan WAF (ModSecurity) dari App Store aaPanel bila perlu.

## Kuota paket

Batas `monthlySearchLimit`, `monthlyReplyLimit`, dan `keywordLimit` pada paket
ditegakkan di server (`src/server/usage/limits.ts`):

- Batas diambil dari langganan aktif pengguna; bila belum ada langganan, paket
  aktif termurah dipakai sebagai batas bawaan. Tanpa paket sama sekali,
  pemakaian tidak dibatasi.
- Pencarian, pengiriman balasan, dan penambahan kata kunci ditolak dengan
  status 429 setelah batas tercapai. Worker melewati pengguna yang kuotanya
  habis, bukan menandai pencarian sebagai gagal.
- Pemakaian bulan berjalan tampil di `/dashboard/langganan`, dan peringatan
  dikirim sebagai notifikasi saat pemakaian mencapai 80 persen.
- Paket juga menentukan jarak minimum antar pencarian terjadwal
  (`Plan.searchIntervalHours`): Starter 24 jam, Bisnis 6 jam, Pro 3 jam.
  Pilihan frekuensi pengguna hanya dapat membuat pencarian lebih jarang, tidak
  lebih sering, sehingga jadwal penuh selalu muat dalam kuota bulanan. Invarian
  ini dijaga oleh pengujian katalog paket.
- `npm run db:audit-quota` memeriksa kesesuaian batas dengan paket di database:
  pergeseran harga/kuota terhadap katalog, proyeksi jadwal terhadap kuota, dan
  selisih antara penghitung kuota dengan jejak eksekusi.

## Notifikasi

Notifikasi dalam aplikasi tersimpan di tabel `Notification` dan muncul pada
ikon lonceng dashboard pengguna (`GET|PATCH /api/notifications`). Pemicunya:
lead baru dari pencarian, hasil pengiriman balasan, keputusan moderasi, dan
peringatan kuota.

Pengiriman email masih berupa adapter tanpa provider (`src/server/integrations/email/mailer.ts`),
jadi salinan email belum terkirim. Preferensi email tetap tersimpan per akun dan
akan dipakai begitu provider diisi.

## Pendaftaran lewat Threads

OAuth Threads juga berfungsi sebagai pendaftaran. Akun yang dibuat lewat jalur
ini tidak memiliki email dari Meta, jadi:

- email diisi placeholder (`threads-<id>@placeholder.carimarket.invalid`) dan
  ditandai `emailIsPlaceholder`, sehingga tidak pernah dianggap dapat dihubungi;
- pembuatan akun tercatat di audit log sebagai `AUTH_THREADS_SIGNUP`;
- pengguna dapat mengisi email nyata dan kata sandi di Pengaturan → Keamanan
  dan data;
- panel Superadmin → Pengguna menandai akun dengan email placeholder atau email
  yang belum terverifikasi;
- setel `THREADS_SIGNUP_ENABLED="false"` untuk melarang pembuatan akun baru dari
  OAuth; jalur itu hanya menghubungkan akun yang sudah masuk.

## Formulir kontak

`POST /api/contact` menyimpan pesan ke tabel `ContactSubmission` dengan
pembatasan origin dan rate limit. Pesan dapat dibaca di Admin → Tiket dukungan
dan Superadmin → Pesan kontak. Notifikasi email ke tim menyusul bersama adapter
email.

## Batas rate limit

`enforceRateLimit` menyimpan hitungan di memori proses: tidak dibagi antar
instance dan hilang saat restart. Entri kedaluwarsa dibersihkan berkala dan
jumlah kunci dibatasi. Untuk beberapa instance di belakang load balancer,
pindahkan hitungan ini ke penyimpanan bersama.

## Mode integrasi

- `INTEGRATION_MODE=live`: menggunakan OAuth dan API resmi Threads.
- `INTEGRATION_MODE=local`: hanya untuk pengembangan adapter tanpa koneksi eksternal.

## Worker latar

Aplikasi menjalankan pekerjaan terjadwal di dalam proses server (via `instrumentation.ts`), tanpa Redis:

- **Pencarian berkala**: kata kunci aktif dengan frekuensi `HOURLY`/`DAILY` dijalankan sesuai `nextRunAt`.
- **Draft & kirim otomatis**: lead baru mendapat draft AI; mode `Tinjau dulu` menghasilkan `PENDING_APPROVAL`, mode `Balas otomatis` menjadwalkan kirim dengan ambang skor, batas harian, jeda, quiet hours, kuota paket, dan penahanan draft berisiko (blacklist → `FLAGGED` + antrean moderasi).
- **Publikasi artikel terjadwal**: artikel berstatus `SCHEDULED` yang jadwalnya lewat diterbitkan otomatis dan tercatat di audit log sebagai `ARTICLE_AUTO_PUBLISHED`.
- Pemicu manual & status: `GET|POST /api/admin/jobs` (Superadmin untuk POST), tampilan di `/superadmin/sistem` dan `/admin/monitoring`.
- Konfigurasi: `WORKER_ENABLED="false"` untuk mematikan, `WORKER_INTERVAL_MS` untuk interval siklus (minimum 15 detik; default 60 detik).
- Untuk produksi dengan banyak pengguna, pindahkan ke worker/cron terpisah yang memanggil fungsi `src/server/jobs/` yang sama.

## Menghubungkan Threads

1. Buat Meta App dengan use case Threads.
2. Salin `.env.example` menjadi `.env`, lalu isi `THREADS_APP_ID` dan `THREADS_APP_SECRET` dari bagian **Threads App** di Meta App Dashboard → App settings → Basic. Isi juga `DATABASE_URL` dan `APP_ENCRYPTION_KEY`.
3. Daftarkan callback OAuth berikut di Meta App: `https://localhost:3000/api/integrations/threads/callback` atau URL HTTPS aplikasi produksi yang setara. URL harus sama persis dengan `NEXT_PUBLIC_APP_URL` ditambah path callback.
4. Jalankan `npm run db:deploy` dan `npm run db:seed`.
5. Jalankan `npm run dev:https`, lalu buka Pengaturan → Integrasi Threads → Hubungkan Threads. Halaman Superadmin → Integrasi Threads menampilkan hasil validasi App ID/Secret tanpa menampilkan nilainya.

Scope yang diminta adalah `threads_basic`, `threads_keyword_search`, dan `threads_content_publish`. Token jangka panjang disimpan terenkripsi menggunakan AES-256-GCM dan diperbarui sebelum kedaluwarsa.

### Ketahanan dan diagnosis koneksi

- Kegagalan sementara di sisi Meta (HTTP 5xx, 429, atau kode 0/1/2/4/17/341/368) dicoba ulang dua kali untuk penukaran dan pembaruan token. Penukaran kode otorisasi tidak pernah diulang karena kodenya sekali pakai.
- Bila penukaran ke token jangka panjang gagal, koneksi tetap disimpan memakai token jangka pendek (`tokenKind = SHORT_LIVED`). Pengguna dapat langsung memakai integrasi, sistem mencoba meningkatkan token pada pemakaian berikutnya, dan halaman Pengaturan menampilkan peringatan beserta waktu kedaluwarsanya.
- Pembaruan token yang gagal tidak lagi langsung menandai koneksi kedaluwarsa; token lama tetap dipakai selama masih berlaku, dan kode kegagalan terakhir disimpan di `ThreadsConnection.lastErrorCode` serta tampil di Superadmin → Kuota API.
- Pesan asli dari Meta (`message`, `code`, `error_subcode`, `type`, `fbtrace_id`) dicatat ke log server dalam satu baris setelah disensor dari token dan secret, dan kegagalan perpanjangan token tercatat di audit log sebagai `THREADS_TOKEN_EXTEND_FAILED`. Sebelumnya hanya kode angka yang tercatat sehingga penyebabnya tidak dapat ditelusuri.

Endpoint aplikasi:

- `GET /api/integrations/threads/connect` memulai OAuth.
- `GET /api/integrations/threads/callback` menukar code, mengambil profil, dan menyimpan token terenkripsi.
- `GET /api/integrations/threads/status` membaca status koneksi tanpa mengekspos token.
- `POST /api/integrations/threads/disconnect` memutus dan menghapus token tersimpan.
- `POST /api/threads/search` menjalankan pencarian keyword.
- `POST /api/threads/reply` mengirim balasan teks dengan `reply_to_id`, idempotency, dan pencatatan status pengiriman.
- `GET|POST|PATCH|DELETE /api/keywords` mengelola kata kunci workspace di MySQL. Kata kunci bertipe `EXCLUDE` menyaring postingan sebelum menjadi lead.
- `GET|PATCH /api/notifications` membaca dan menandai notifikasi pengguna.
- `GET|PUT /api/settings/account-email` menampilkan dan mengganti email akun.
- `POST /api/onboarding/complete` menandai onboarding selesai.
- `GET|PUT /api/settings/reply-automation` menyimpan aturan tinjau/otomatis di MySQL.
- `PATCH /api/admin/users` menangguhkan/mengaktifkan akun (SUPERADMIN), `POST /api/admin/users/connections` mereset koneksi Threads pengguna.
- `POST|PATCH|DELETE /api/admin/admins` mempromosikan, mengatur permission, dan menurunkan akun Admin (SUPERADMIN).
- `POST /api/admin/moderation` memutus draft tertanda (ADMIN/SUPERADMIN).
- `GET|POST|DELETE /api/admin/blacklist` mengelola istilah terlarang (SUPERADMIN).

Pengiriman dari halaman detail lead dipublikasikan langsung. Aturan mode otomatis sudah tersimpan dan dipakai untuk menentukan kelayakan draft; eksekusi terjadwal tanpa interaksi pengguna memerlukan proses worker/cron terpisah sebelum dipakai di produksi.

## Paket langganan

Superadmin dapat menambah dan mengubah paket dari Superadmin → **Paket dan
billing**: harga, kuota pencarian, kuota balasan, batas kata kunci, interval
pencarian, dan status aktif. Perubahan langsung berlaku pada penegakan kuota
dan halaman harga publik.

Validasi server menolak kombinasi yang tidak masuk akal: jadwal penuh (batas
kata kunci dengan interval paket) tidak boleh melampaui kuota pencarian
bulanan, pemakaian harian tidak boleh melampaui batas Meta (2.200 pencarian dan
1.000 balasan per 24 jam), dan paket yang masih dipakai langganan aktif tidak
dapat dinonaktifkan. Batas bernilai 0 berarti tanpa batas.

`npm run db:plans` kini **tidak menimpa** paket yang sudah ada, supaya
penyuntingan dari panel tidak hilang saat deploy. Pakai `PLAN_SYNC_FORCE=1`
bila memang ingin memaksa nilai katalog kembali. Teks pemasaran paket (tagline
dan daftar keunggulan) tetap berasal dari `prisma/plan-catalog.ts`; paket yang
dibuat lewat panel dan belum ada di katalog ditampilkan di halaman harga dengan
ringkasan kuota otomatis.

## Profil akun internal

Akun Admin dan Superadmin memiliki halaman profil sendiri di `/admin/profil`
dan `/superadmin/profil`: identitas (nama dan email), kata sandi, role, hak
akses, dan waktu masuk terakhir. Sebelumnya endpoint kata sandi dan email
dibatasi role `USER`, sehingga akun internal tidak dapat mengganti sandinya
sendiri.

Operasi tingkat akun kini netral role di `/api/account/profile` dan
`/api/account/password`, dipakai bersama oleh pengaturan pengguna bisnis dan
halaman profil internal.

## Akun Superadmin pada instalasi baru

Database produksi tidak memakai seed pengembangan, jadi akun Superadmin dibuat
secara sadar satu kali:

```bash
SUPERADMIN_EMAIL=nama@domain.com SUPERADMIN_PASSWORD='sandi minimal 12 karakter' npm run db:create-superadmin
```

Tanpa `SUPERADMIN_PASSWORD`, skrip membuat sandi acak dan menampilkannya sekali
untuk segera diganti. Skrip menolak berjalan bila sudah ada Superadmin, kecuali
`ALLOW_ADDITIONAL_SUPERADMIN=1` disertakan. Email yang sudah terdaftar akan
dipromosikan tanpa mengganti sandinya, kecuali sandi baru disertakan.

## API aplikasi mobile

API tersedia di `/api/v1` dan cakupannya hanya **menu pengguna bisnis**: tidak
ada endpoint admin maupun superadmin, dan satu kredensial hanya membuka satu
workspace.

### Autentikasi

Token dikirim sebagai `Authorization: Bearer cmk_<8 heks>_<64 heks>` dan
diperoleh melalui tiga jalur:

1. **Masuk dari aplikasi** — `POST /api/v1/auth/login` dengan email dan kata
   sandi pengguna. Ini jalur utama untuk aplikasi dengan banyak pengguna:
   pengguna mendapatkan tokennya sendiri tanpa campur tangan Superadmin.
2. **Kode pemasangan** — pengguna membuat kode di Pengaturan → Keamanan dan
   data, lalu aplikasi menukarnya lewat `POST /api/v1/auth/pair`. Dipakai akun
   yang masuk lewat Threads sehingga belum memiliki kata sandi. Kode berlaku 10
   menit dan sekali pakai.
3. **Kunci integrasi internal** — dibuat lewat `POST /api/admin/api-credentials`
   memakai sesi Superadmin. Form penerbitannya tidak ada di halaman API karena
   pengguna sudah memperoleh tokennya sendiri.

Berlaku untuk semua jalur:

- Hanya hash SHA-256 token yang disimpan; nilainya tampil satu kali saat
  diterbitkan dan tidak pernah dapat ditampilkan ulang.
- Token login dan pemasangan berlaku 90 hari, maksimal 10 perangkat aktif per
  akun, dan perangkat terlama otomatis dicabut saat batas terlampaui.
- Pengguna dapat melihat dan mencabut perangkatnya sendiri dari aplikasi
  (`GET|DELETE /api/v1/me/devices`) maupun dari dashboard web.
- Penerbitan dan pencabutan tercatat di audit log (`MOBILE_LOGIN`,
  `MOBILE_PAIRED`, `MOBILE_DEVICE_REVOKED`, `API_CREDENTIAL_ISSUED`,
  `API_CREDENTIAL_REVOKED`) tanpa nilai token.
- Batas laju 120 permintaan per menit per token, dan 20 per menit per alamat IP
  untuk endpoint tanpa token. Percobaan masuk dibatasi 10 per 5 menit per email.

### Format respons

Setiap respons, berhasil maupun gagal, memakai amplop yang sama:

```json
{ "success": true, "data": { }, "meta": { "requestId": "…", "timestamp": "…" } }
{ "success": false, "error": { "code": "QUOTA_EXCEEDED", "message": "…", "details": null }, "meta": { "requestId": "…", "timestamp": "…" } }
```

`meta.page` ditambahkan pada endpoint berbentuk daftar, `error.details` memuat
pemetaan kolom ke pesan saat validasi gagal, waktu selalu ISO 8601 UTC, dan
metrik yang tidak diketahui bernilai null bukan nol. Header `X-Request-Id`
berisi nilai yang sama dengan `meta.requestId`.

### Dokumentasi

Dokumentasi lengkap hanya dapat diakses Superadmin:

- Halaman referensi: Superadmin → **API Mobile**, dipisah menjadi tab
  (Autentikasi, Format respons, Kode error, Referensi endpoint, Token aktif).
  Referensi endpoint memakai akordeon per kelompok dan per endpoint sehingga
  halaman tetap pendek.
- Berkas OpenAPI 3.1: `GET /api/admin/api-docs` (butuh sesi Superadmin).

Halaman dokumentasi dan berkas OpenAPI dihasilkan dari katalog yang sama
(`src/server/api/catalog.ts`), dan pengujian memastikan setiap endpoint yang ada
benar-benar terdaftar di katalog.

### Memverifikasi API

```bash
npm run api:smoke -- https://carimarket.id
```

Skrip menerbitkan kredensial sementara, memanggil seluruh endpoint baca,
memastikan kunci asing dan kunci tercabut ditolak, lalu mencabut kredensial itu
kembali. Tidak ada endpoint yang mengubah data workspace atau memakai kuota yang
dipanggil.

## Mode pra-App-Review (pencarian Threads tanpa persetujuan Meta)

Sebelum Meta menyetujui App Review, pencarian keyword tetap jalan dengan memakai sesi web Threads. Tidak butuh `THREADS_APP_ID`/`THREADS_APP_SECRET`; yang dibutuhkan adalah cookie sesi browser yang sudah masuk Threads.

Cara mengaktifkan (hanya Superadmin):

1. Buka `https://www.threads.com` di browser, masuk dengan akun yang dipakai untuk memantau.
2. Ambil nilai cookie berikut: `sessionid`, `csrftoken`, `ds_user_id` (cukup salin ketiganya sebagai satu string cookie).
3. Ambil token `lsd` dari header `x-fb-lsd` request GraphQL apa pun di halaman search Threads (lihat DevTools → Network).
4. Buka Superadmin → **Integrasi** (`/superadmin/integrasi`), isi form, lalu simpan.
5. Sistem menyimpan kredensial terenkripsi (AES-256-GCM) di database dan langsung menjalankan satu pencarian uji. Jika sukses, pencarian keyword aktif.

Catatan penting:

- Cookie sesi web bisa kedaluwarsa. Saat itu terjadi, pencarian gagal dengan pesan "Sesi Threads kedaluwarsa" dan Superadmin cukup mengisi ulang form yang sama.
- Jalur ini **hanya untuk pencarian**. Mengirim balasan tetap butuh API resmi Meta; setelah App Review disetujui, hubungkan akun via OAuth (Pengaturan → Integrasi Threads) dan jalur resmi akan otomatis dipakai.
- Saat keduanya tersedia, OAuth resmi dipakai lebih dulu; jalur pra-App-Review menjadi cadangan.
- Menghapus kredensial dari panel mematikan pencarian hingga diisi ulang.

Lihat `PRD.md`, `cari-market-build.md`, dan `AGENTS.md` untuk keputusan produk dan arsitektur.
