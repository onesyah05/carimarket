/**
 * Katalog endpoint API mobile.
 *
 * Satu sumber kebenaran untuk halaman dokumentasi Superadmin dan berkas
 * OpenAPI. Menambah endpoint tanpa mendaftarkannya di sini akan tertangkap
 * oleh pengujian katalog.
 *
 * Modul ini murni agar dapat diuji dan dipakai komponen server tanpa akses
 * database.
 */

export type ApiFieldType = "string" | "number" | "integer" | "boolean" | "array" | "object";

export type ApiField = {
  name: string;
  type: ApiFieldType;
  required?: boolean;
  description: string;
};

export type ApiEndpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  group: string;
  summary: string;
  description?: string;
  query?: ApiField[];
  body?: ApiField[];
  /** Isi `data` pada amplop respons, bukan amplop lengkapnya. */
  dataExample: unknown;
  /** Kode error khusus endpoint ini, selain kode umum. */
  errors?: string[];
  /** Endpoint yang sengaja tidak memerlukan token, yaitu masuk dan pemasangan. */
  public?: boolean;
};

export const API_BASE_PATH = "/api/v1";

export const API_GROUPS = [
  { name: "Autentikasi", description: "Masuk dari aplikasi, pemasangan perangkat, dan pencabutan token." },
  { name: "Akun", description: "Identitas workspace, profil bisnis, dan paket." },
  { name: "Beranda", description: "Ringkasan untuk layar utama aplikasi." },
  { name: "Lead", description: "Daftar dan detail percakapan Threads yang cocok." },
  { name: "Kata kunci", description: "Kata kunci pencarian dan kata kunci negatif." },
  { name: "Balasan", description: "Draft, pengiriman, dan riwayat balasan." },
  { name: "Pembayaran", description: "Upgrade paket, tagihan, dan konfirmasi pembayaran." },
  { name: "Pengaturan", description: "Mode balasan, profil bisnis, dan notifikasi." },
  { name: "Integrasi", description: "Status koneksi Threads workspace." },
] as const;

const leadExample = {
  id: "clz2lead0001",
  status: "NEW",
  statusLabel: "Baru",
  score: 96,
  matchReason: "Cocok dengan kata kunci jasa drone",
  keyword: "jasa drone",
  sourceMode: "PUBLIC_SEARCH",
  flagged: false,
  discoveredAt: "2026-10-10T07:15:00.000Z",
  post: {
    externalId: "17912345678901234",
    permalink: "https://www.threads.com/@andriworks/post/C9xYz",
    text: "Ada rekomendasi jasa drone untuk dokumentasi proyek di BSD?",
    postedAt: "2026-10-10T07:02:00.000Z",
    author: { name: "Andri Wijaya", handle: "@andriworks" },
    engagement: { likes: 12, replies: 3, reposts: null },
  },
};

const keywordExample = {
  id: "clz2kw0001",
  phrase: "jasa drone",
  kind: "INCLUDE",
  negative: false,
  frequency: "HOURLY",
  effectiveIntervalHours: 6,
  active: true,
  matchCount: 14,
  lastRunAt: "2026-10-10T06:00:00.000Z",
  nextRunAt: "2026-10-10T12:00:00.000Z",
};

const quotaExample = {
  periodStart: "2026-10-01T00:00:00.000Z",
  searches: { used: 243, limit: 2000, remaining: 1757, allowed: true, warning: false, percentage: 12 },
  replies: { used: 18, limit: 300, remaining: 282, allowed: true, warning: false, percentage: 6 },
  keywords: { used: 4, limit: 10, remaining: 6, allowed: true, warning: false, percentage: 40 },
};

const planExample = { code: "BISNIS", name: "Bisnis", source: "subscription", searchIntervalHours: 6 };

const replyAutomationExample = {
  mode: "review",
  minimumScore: 90,
  dailyLimit: 10,
  delayMinutes: 15,
  pauseOnRisk: true,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
};

const transactionExample = {
  id: "clz2trx0001",
  invoiceNumber: "INV-20261011-7K3M",
  status: "PENDING",
  statusLabel: "Menunggu pembayaran",
  planCode: "BISNIS",
  planName: "Bisnis",
  periodMonths: 1,
  baseAmount: 98000,
  uniqueCode: 417,
  totalAmount: 98417,
  paymentMethod: {
    id: "clz2pay0001",
    channel: "BANK_TRANSFER",
    channelLabel: "Transfer bank",
    label: "BCA",
    accountName: "PT Cari Market Indonesia",
    accountNumber: "1234567890",
    instructions: null,
  },
  payerName: null,
  payerNote: null,
  reviewNote: null,
  expiresAt: "2026-10-12T07:00:00.000Z",
  submittedAt: null,
  reviewedAt: null,
  createdAt: "2026-10-11T07:00:00.000Z",
  open: true,
};

const deviceTokenExample = {
  token: "cmk_1a2b3c4d_8f6e5d4c3b2a19087f6e5d4c3b2a19087f6e5d4c3b2a19087f6e5d4c3b2a1908",
  tokenPrefix: "cmk_1a2b3c4d",
  expiresAt: "2027-01-08T08:00:00.000Z",
  device: { id: "clz2dev0001", name: "Android Nadia" },
};

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: "POST",
    path: "/api/v1/auth/login",
    group: "Autentikasi",
    summary: "Masuk dari aplikasi",
    description: "Tidak memerlukan kredensial apa pun. Mengembalikan token perangkat berlaku 90 hari yang dipakai pada seluruh endpoint lain. Maksimal 10 perangkat aktif per akun; perangkat terlama otomatis dicabut. Dibatasi 10 percobaan per 5 menit per email dan 20 permintaan per menit per alamat IP.",
    body: [
      { name: "email", type: "string", required: true, description: "Email akun pengguna." },
      { name: "password", type: "string", required: true, description: "Kata sandi akun." },
      { name: "deviceName", type: "string", description: "Nama perangkat agar mudah dikenali pengguna, mis. Android Nadia." },
    ],
    dataExample: deviceTokenExample,
    errors: ["INVALID_CREDENTIALS", "PASSWORD_NOT_SET", "ACCOUNT_INACTIVE", "FORBIDDEN", "RATE_LIMITED"],
    public: true,
  },
  {
    method: "POST",
    path: "/api/v1/auth/pair",
    group: "Autentikasi",
    summary: "Tukar kode pemasangan",
    description: "Untuk akun yang masuk lewat Threads sehingga belum punya kata sandi. Pengguna membuat kode sendiri di dashboard web (Pengaturan, Keamanan dan data). Kode berlaku 10 menit dan hanya dapat ditukar satu kali.",
    body: [
      { name: "code", type: "string", required: true, description: "Kode 8 karakter dari dashboard web, mis. K7MP-3QXA." },
      { name: "deviceName", type: "string", description: "Nama perangkat agar mudah dikenali pengguna." },
    ],
    dataExample: deviceTokenExample,
    errors: ["PAIRING_CODE_INVALID", "PAIRING_CODE_USED", "PAIRING_CODE_EXPIRED", "ACCOUNT_INACTIVE"],
    public: true,
  },
  {
    method: "POST",
    path: "/api/v1/auth/logout",
    group: "Autentikasi",
    summary: "Keluar dan cabut token",
    description: "Mencabut token yang dipakai pada permintaan ini. Permintaan berikutnya dengan token yang sama dijawab CREDENTIAL_REVOKED.",
    dataExample: { revoked: true },
  },
  {
    method: "GET",
    path: "/api/v1/me/devices",
    group: "Autentikasi",
    summary: "Daftar perangkat tertaut",
    dataExample: [{
      id: "clz2dev0001",
      name: "Android Nadia",
      source: "USER_LOGIN",
      sourceLabel: "Masuk dari aplikasi",
      tokenPrefix: "cmk_1a2b3c4d",
      createdAt: "2026-10-10T08:00:00.000Z",
      lastUsedAt: "2026-10-10T09:12:00.000Z",
      expiresAt: "2027-01-08T08:00:00.000Z",
    }],
  },
  {
    method: "DELETE",
    path: "/api/v1/me/devices/{id}",
    group: "Autentikasi",
    summary: "Cabut salah satu perangkat",
    dataExample: { id: "clz2dev0001", revoked: true },
    errors: ["NOT_FOUND"],
  },
  {
    method: "GET",
    path: "/api/v1/me",
    group: "Akun",
    summary: "Identitas workspace",
    description: "Dipanggil sekali saat aplikasi dibuka untuk mengetahui pemilik kredensial, profil bisnis, paket, dan status Threads.",
    dataExample: {
      user: { id: "clz2user0001", name: "Nadia Pratama", email: "nadia@langitvisual.id", emailIsPlaceholder: false, joinedAt: "2026-09-20T03:00:00.000Z" },
      business: { name: "Langit Visual", category: "Jasa Drone", description: "Dokumentasi udara untuk properti dan acara.", serviceArea: "Jabodetabek", onboardingCompletedAt: "2026-09-20T04:10:00.000Z" },
      plan: planExample,
      threads: { connected: true, username: "langitvisual" },
    },
  },
  {
    method: "GET",
    path: "/api/v1/me/overview",
    group: "Beranda",
    summary: "Ringkasan beranda",
    dataExample: {
      leads: { new: 5, saved: 2, replied: 8, total: 15 },
      replies: { awaitingReview: 3 },
      notifications: { unread: 2 },
      replyMode: "review",
      plan: planExample,
      quota: quotaExample,
      threads: { connected: true, username: "langitvisual", tokenShortLived: false },
    },
  },
  {
    method: "GET",
    path: "/api/v1/me/leads",
    group: "Lead",
    summary: "Daftar lead",
    description: "Diurutkan dari lead terbaru. Memakai `meta.page` untuk paginasi.",
    query: [
      { name: "page", type: "integer", description: "Halaman, mulai dari 1. Bawaan 1." },
      { name: "perPage", type: "integer", description: "Jumlah per halaman, 1 sampai 100. Bawaan 20." },
      { name: "status", type: "string", description: "Saring status: NEW, SAVED, REPLIED, atau ARCHIVED." },
      { name: "minScore", type: "integer", description: "Skor relevansi minimum, 0 sampai 100." },
      { name: "q", type: "string", description: "Cari teks pada isi postingan." },
    ],
    dataExample: [leadExample],
  },
  {
    method: "GET",
    path: "/api/v1/me/leads/{id}",
    group: "Lead",
    summary: "Detail lead",
    description: "Menyertakan draft balasan terakhir untuk lead tersebut bila ada.",
    dataExample: { ...leadExample, draft: { id: "clz2draft0001", body: "Halo Kak, kami dari Langit Visual...", status: "PENDING_APPROVAL", statusLabel: "Menunggu tinjauan", scheduledFor: null, sentAt: null, updatedAt: "2026-10-10T07:20:00.000Z" } },
    errors: ["NOT_FOUND"],
  },
  {
    method: "PATCH",
    path: "/api/v1/me/leads/{id}",
    group: "Lead",
    summary: "Simpan atau lepas simpan lead",
    body: [{ name: "saved", type: "boolean", required: true, description: "true menyimpan lead, false mengembalikannya ke status baru." }],
    dataExample: { id: "clz2lead0001", status: "SAVED", statusLabel: "Tersimpan" },
    errors: ["NOT_FOUND", "CONFLICT"],
  },
  {
    method: "POST",
    path: "/api/v1/me/searches",
    group: "Lead",
    summary: "Jalankan pencarian Threads",
    description: "Kata kunci disimpan ke workspace lalu dijalankan sekali. Memakai kuota pencarian dan kuota kata kunci paket.",
    body: [{ name: "query", type: "string", required: true, description: "Kata kunci, 2 sampai 100 karakter." }],
    dataExample: { keyword: { id: "clz2kw0001", phrase: "jasa drone" }, resultCount: 7, excludedCount: 2, newLeadCount: 5 },
    errors: ["QUOTA_EXCEEDED", "THREADS_UNAVAILABLE"],
  },
  {
    method: "GET",
    path: "/api/v1/me/keywords",
    group: "Kata kunci",
    summary: "Daftar kata kunci",
    description: "`limit` menghitung seluruh kata kunci, termasuk yang dijeda dan kata kunci negatif.",
    dataExample: { items: [keywordExample], limit: 10, used: 4, planSearchIntervalHours: 6 },
  },
  {
    method: "POST",
    path: "/api/v1/me/keywords",
    group: "Kata kunci",
    summary: "Tambah kata kunci",
    body: [
      { name: "phrase", type: "string", required: true, description: "Frasa kata kunci, 2 sampai 120 karakter." },
      { name: "negative", type: "boolean", description: "true membuat kata kunci negatif yang menyaring lead. Bawaan false." },
    ],
    dataExample: keywordExample,
    errors: ["QUOTA_EXCEEDED"],
  },
  {
    method: "PATCH",
    path: "/api/v1/me/keywords/{id}",
    group: "Kata kunci",
    summary: "Ubah status atau jadwal kata kunci",
    description: "Jadwal lebih cepat dari paket tetap dibatasi interval paket; lihat `effectiveIntervalHours`.",
    body: [
      { name: "active", type: "boolean", description: "Mengaktifkan atau menjeda kata kunci." },
      { name: "frequency", type: "string", description: "MANUAL, HOURLY, atau DAILY." },
    ],
    dataExample: keywordExample,
    errors: ["NOT_FOUND", "INVALID_INPUT"],
  },
  {
    method: "DELETE",
    path: "/api/v1/me/keywords/{id}",
    group: "Kata kunci",
    summary: "Hapus kata kunci",
    dataExample: { id: "clz2kw0001", deleted: true },
    errors: ["NOT_FOUND"],
  },
  {
    method: "PUT",
    path: "/api/v1/me/leads/{id}/draft",
    group: "Balasan",
    summary: "Simpan draft balasan",
    description: "Menyimpan draft tanpa mengirim. Draft yang sudah diproses tidak dapat diubah.",
    body: [
      { name: "body", type: "string", required: true, description: "Isi draft, 1 sampai 500 karakter." },
      { name: "draftId", type: "string", description: "Draft yang diperbarui. Kosongkan untuk membuat draft baru." },
    ],
    dataExample: { id: "clz2draft0001", body: "Halo Kak, kami dari Langit Visual...", status: "DRAFT" },
    errors: ["NOT_FOUND", "CONFLICT"],
  },
  {
    method: "GET",
    path: "/api/v1/me/replies",
    group: "Balasan",
    summary: "Riwayat draft dan balasan",
    query: [
      { name: "page", type: "integer", description: "Halaman, mulai dari 1." },
      { name: "perPage", type: "integer", description: "Jumlah per halaman, 1 sampai 100." },
      { name: "status", type: "string", description: "Saring status, mis. PENDING_APPROVAL, SCHEDULED, SENT, FAILED." },
    ],
    dataExample: [{
      id: "clz2draft0001",
      leadId: "clz2lead0001",
      body: "Halo Kak, kami dari Langit Visual...",
      status: "SENT",
      statusLabel: "Terkirim",
      deliveryMode: "REVIEW_FIRST",
      keyword: "jasa drone",
      recipient: { name: "Andri Wijaya", handle: "@andriworks", permalink: "https://www.threads.com/@andriworks/post/C9xYz" },
      scheduledFor: null,
      sentAt: "2026-10-10T08:00:00.000Z",
      updatedAt: "2026-10-10T08:00:00.000Z",
      lastAttempt: { status: "SENT", errorCode: null, externalReplyId: "17998877665544332", attemptedAt: "2026-10-10T08:00:00.000Z" },
    }],
  },
  {
    method: "POST",
    path: "/api/v1/me/replies",
    group: "Balasan",
    summary: "Kirim balasan ke Threads",
    description: "Memakai kuota balasan paket. Bersifat idempoten: `idempotencyKey` yang sama tidak mengirim dua kali. Pengiriman memerlukan koneksi Threads resmi.",
    body: [
      { name: "leadId", type: "string", required: true, description: "Lead yang dibalas." },
      { name: "body", type: "string", required: true, description: "Isi balasan, 1 sampai 500 karakter." },
      { name: "idempotencyKey", type: "string", required: true, description: "Kunci unik per percobaan kirim, minimal 8 karakter." },
      { name: "draftId", type: "string", description: "Draft yang disetujui, bila sudah ada." },
      { name: "postId", type: "string", description: "ID postingan Threads untuk verifikasi tambahan." },
    ],
    dataExample: { draftId: "clz2draft0001", status: "SENT", externalReplyId: "17998877665544332" },
    errors: ["NOT_FOUND", "CONFLICT", "QUOTA_EXCEEDED", "THREADS_UNAVAILABLE"],
  },
  {
    method: "GET",
    path: "/api/v1/me/reply-automation",
    group: "Pengaturan",
    summary: "Mode balasan workspace",
    dataExample: replyAutomationExample,
  },
  {
    method: "PUT",
    path: "/api/v1/me/reply-automation",
    group: "Pengaturan",
    summary: "Ubah mode balasan",
    body: [
      { name: "mode", type: "string", required: true, description: "review atau auto." },
      { name: "minimumScore", type: "integer", required: true, description: "Ambang relevansi 70 sampai 100." },
      { name: "dailyLimit", type: "integer", required: true, description: "Batas balasan harian 1 sampai 50." },
      { name: "delayMinutes", type: "integer", required: true, description: "Jeda kirim: 5, 15, 30, atau 60." },
      { name: "pauseOnRisk", type: "boolean", required: true, description: "Menahan draft berisiko untuk ditinjau manual." },
      { name: "quietHoursEnabled", type: "boolean", description: "Mengaktifkan jam tenang." },
      { name: "quietHoursStart", type: "string", description: "Jam mulai HH:MM dalam UTC. Wajib bila jam tenang aktif." },
      { name: "quietHoursEnd", type: "string", description: "Jam selesai HH:MM dalam UTC. Wajib bila jam tenang aktif." },
    ],
    dataExample: { ...replyAutomationExample, mode: "auto" },
    errors: ["INVALID_INPUT"],
  },
  {
    method: "GET",
    path: "/api/v1/me/business-profile",
    group: "Pengaturan",
    summary: "Profil bisnis",
    dataExample: { exists: true, name: "Langit Visual", category: "Jasa Drone", serviceArea: "Jabodetabek", description: "Dokumentasi udara untuk properti dan acara." },
  },
  {
    method: "PUT",
    path: "/api/v1/me/business-profile",
    group: "Pengaturan",
    summary: "Simpan profil bisnis",
    body: [
      { name: "name", type: "string", required: true, description: "Nama bisnis, 2 sampai 140 karakter." },
      { name: "category", type: "string", required: true, description: "Kategori layanan." },
      { name: "serviceArea", type: "string", required: true, description: "Area layanan." },
      { name: "description", type: "string", required: true, description: "Deskripsi singkat, maksimal 5.000 karakter." },
    ],
    dataExample: { exists: true, name: "Langit Visual", category: "Jasa Drone", serviceArea: "Jabodetabek", description: "Dokumentasi udara untuk properti dan acara." },
    errors: ["INVALID_INPUT"],
  },
  {
    method: "GET",
    path: "/api/v1/me/notification-preferences",
    group: "Pengaturan",
    summary: "Preferensi salinan email",
    dataExample: { emailLead: true, emailReply: true, emailQuota: true },
  },
  {
    method: "PUT",
    path: "/api/v1/me/notification-preferences",
    group: "Pengaturan",
    summary: "Ubah preferensi salinan email",
    body: [
      { name: "emailLead", type: "boolean", required: true, description: "Email saat ada lead baru." },
      { name: "emailReply", type: "boolean", required: true, description: "Email saat status balasan berubah." },
      { name: "emailQuota", type: "boolean", required: true, description: "Email saat kuota mendekati batas." },
    ],
    dataExample: { emailLead: true, emailReply: false, emailQuota: true },
  },
  {
    method: "GET",
    path: "/api/v1/me/notifications",
    group: "Pengaturan",
    summary: "Notifikasi dalam aplikasi",
    query: [{ name: "limit", type: "integer", description: "Jumlah notifikasi, 1 sampai 100. Bawaan 20." }],
    dataExample: {
      items: [{ id: "clz2notif0001", type: "LEAD_DISCOVERED", title: "5 lead baru ditemukan", body: "Kata kunci jasa drone menemukan 5 percakapan baru yang relevan.", href: "/dashboard/leads", read: false, createdAt: "2026-10-10T07:15:00.000Z" }],
      unread: 2,
    },
  },
  {
    method: "PATCH",
    path: "/api/v1/me/notifications",
    group: "Pengaturan",
    summary: "Tandai notifikasi terbaca",
    body: [{ name: "ids", type: "array", description: "Daftar id notifikasi. Kosongkan untuk menandai semuanya." }],
    dataExample: { marked: 2, unread: 0 },
  },
  {
    method: "GET",
    path: "/api/v1/me/subscription",
    group: "Akun",
    summary: "Paket dan pemakaian kuota",
    dataExample: {
      plan: planExample,
      quota: quotaExample,
      subscription: { status: "TRIAL", statusLabel: "Uji coba", planCode: "BISNIS", planName: "Bisnis", monthlyPrice: 98000, currentPeriodStart: "2026-10-01T00:00:00.000Z", currentPeriodEnd: "2026-11-01T00:00:00.000Z" },
    },
  },
  {
    method: "GET",
    path: "/api/v1/me/billing",
    group: "Pembayaran",
    summary: "Pilihan upgrade dan tagihan",
    description: "Layar upgrade memakai satu permintaan ini: paket berbayar yang aktif, metode pembayaran yang tersedia, tagihan yang sedang berjalan, dan riwayat transaksi. Pembayaran diverifikasi manual oleh tim, jadi paket baru berlaku setelah tagihan berstatus PAID.",
    dataExample: {
      currentPlan: { code: "STARTER", name: "Starter", monthlyPrice: 0, source: "default" },
      subscription: null,
      options: [{ id: "clz2plan0002", code: "BISNIS", name: "Bisnis", monthlyPrice: 98000, highlights: ["10 kata kunci termasuk kata negatif"], current: false }],
      paymentMethods: [transactionExample.paymentMethod],
      openTransaction: transactionExample,
      history: [transactionExample],
      paymentWindowHours: 24,
      periodChoices: [1, 3, 6, 12],
    },
  },
  {
    method: "POST",
    path: "/api/v1/me/transactions",
    group: "Pembayaran",
    summary: "Buat tagihan upgrade",
    description: "Nominal akhir memuat kode unik tiga digit yang harus ikut ditransfer agar pembayaran dikenali pada mutasi. Satu akun hanya boleh memiliki satu tagihan terbuka; bila masih ada, permintaan dijawab CONFLICT.",
    body: [
      { name: "planId", type: "string", required: true, description: "Id paket dari daftar options pada endpoint billing." },
      { name: "paymentMethodId", type: "string", required: true, description: "Id metode pembayaran dari daftar paymentMethods." },
      { name: "periodMonths", type: "integer", required: true, description: "Durasi berlangganan dalam bulan: 1, 3, 6, atau 12." },
    ],
    dataExample: transactionExample,
    errors: ["INVALID_INPUT", "NOT_FOUND", "CONFLICT", "RATE_LIMITED"],
  },
  {
    method: "PATCH",
    path: "/api/v1/me/transactions/{id}",
    group: "Pembayaran",
    summary: "Konfirmasi atau batalkan tagihan",
    description: "Kirim action confirm setelah pengguna benar-benar mentransfer; tagihan masuk antrean verifikasi tim. Action cancel membatalkan tagihan sehingga pengguna dapat membuat tagihan baru.",
    body: [
      { name: "action", type: "string", required: true, description: "Nilai confirm untuk menandai sudah membayar, atau cancel untuk membatalkan." },
      { name: "payerName", type: "string", description: "Wajib saat action confirm: nama pengirim sesuai rekening agar dapat dicocokkan." },
      { name: "payerNote", type: "string", description: "Catatan opsional, mis. bank dan waktu transfer." },
    ],
    dataExample: { ...transactionExample, status: "REVIEW", statusLabel: "Menunggu verifikasi", payerName: "Nadia Pratama", submittedAt: "2026-10-11T08:10:00.000Z" },
    errors: ["INVALID_INPUT", "NOT_FOUND", "CONFLICT"],
  },
  {
    method: "GET",
    path: "/api/v1/me/threads",
    group: "Integrasi",
    summary: "Status koneksi Threads",
    description: "Menghubungkan akun Threads memakai OAuth di peramban, bukan di aplikasi. Buka `connectUrl` pada peramban sistem setelah pengguna masuk ke dashboard web.",
    dataExample: {
      searchAvailable: true,
      connected: true,
      username: "langitvisual",
      capability: "PUBLIC_SEARCH",
      tokenKind: "LONG_LIVED",
      tokenExpiresAt: "2026-12-09T03:00:00.000Z",
      lastErrorCode: null,
      connectUrl: "/api/integrations/threads/connect",
      replyRequiresOfficialConnection: true,
    },
  },
];

export function endpointsByGroup() {
  return API_GROUPS.map(group => ({
    ...group,
    endpoints: API_ENDPOINTS.filter(endpoint => endpoint.group === group.name),
  }));
}
