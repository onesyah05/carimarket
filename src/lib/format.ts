const TZ = "Asia/Jakarta";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dateFormatter = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value)) + " WIB";
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

const rupiahFormatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

/** Harga dalam Rupiah tanpa desimal, mis. "Rp 98.000". Nol ditulis "Gratis". */
export function formatRupiah(value: number, options?: { zeroLabel?: string }) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return options?.zeroLabel ?? "Gratis";
  // Intl memakai spasi tak-putus setelah "Rp"; diganti spasi biasa agar konsisten.
  return rupiahFormatter.format(value).replace(/\u00a0/g, " ");
}

export const STATUS_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: "Menunggu verifikasi",
  ACTIVE: "Aktif",
  SUSPENDED: "Ditangguhkan",
  PENDING: "Menunggu",
  CONNECTED: "Terhubung",
  EXPIRED: "Kedaluwarsa",
  REVOKED: "Dicabut",
  ERROR: "Error",
  LOCAL_DATA: "Data lokal",
  SELF_ONLY: "Akun sendiri",
  PUBLIC_SEARCH: "Pencarian publik",
  DRAFT: "Draft",
  FLAGGED: "Ditandai",
  PENDING_APPROVAL: "Menunggu tinjauan",
  APPROVED: "Disetujui",
  SCHEDULED: "Terjadwal",
  SENDING: "Mengirim",
  SENT: "Terkirim",
  SIMULATED_SENT: "Simulasi terkirim",
  FAILED: "Gagal",
  CANCELLED: "Dibatalkan",
  USER: "Pengguna",
  ADMIN: "Admin",
  SUPERADMIN: "Superadmin",
  TRIAL: "Uji coba",
  PAST_DUE: "Jatuh tempo",
  IN_REVIEW: "Dalam review",
  ARCHIVED: "Arsip",
  PUBLISHED: "Terbit",
  OPEN: "Terbuka",
  IN_PROGRESS: "Diproses",
  WAITING_USER: "Menunggu pengguna",
  RESOLVED: "Selesai",
  CLOSED: "Ditutup",
  LOW: "Rendah",
  NORMAL: "Normal",
  HIGH: "Tinggi",
  URGENT: "Mendesak",
  AUTH_LOGIN: "Masuk",
  AUTH_REGISTERED: "Pendaftaran",
  AUTH_THREADS_SIGNUP: "Daftar lewat Threads",
  ACCOUNT_PASSWORD_CHANGED: "Ganti kata sandi",
  ACCOUNT_EMAIL_UPDATED: "Ubah email",
  ACCOUNT_NAME_UPDATED: "Ubah nama",
  ACCOUNT_CLOSED: "Akun ditutup",
  PASSWORD_RESET_REQUESTED: "Minta atur ulang sandi",
  PASSWORD_RESET_COMPLETED: "Atur ulang sandi selesai",
  USER_CREATED: "Akun dibuat",
  USER_SUSPENDED: "Akun ditangguhkan",
  USER_REACTIVATED: "Akun diaktifkan",
  BUSINESS_PROFILE_CREATED: "Profil bisnis dibuat",
  MOBILE_LOGIN: "Masuk dari aplikasi",
  MOBILE_PAIRED: "Perangkat dipasangkan",
  MOBILE_DEVICE_REVOKED: "Perangkat dicabut",
  MOBILE_PAIRING_CODE_CREATED: "Kode pemasangan dibuat",
  SUPPORT_TICKET_CREATED: "Tiket dibuat",
  SUPPORT_TICKET_REPLIED: "Tiket dibalas",
  SUPPORT_TICKET_NOTE_ADDED: "Catatan internal tiket",
  SUPPORT_TICKET_CLOSED: "Tiket ditutup",
  THREADS_TOKEN_EXTEND_FAILED: "Perpanjangan token Threads gagal",
  ARTICLE_AUTO_PUBLISHED: "Artikel terbit otomatis",
  FAQ_CREATED: "FAQ dibuat",
  FAQ_UPDATED: "FAQ diubah",
  FAQ_DELETED: "FAQ dihapus",
  FAQ_SEEDED: "FAQ diisi dari bawaan",
  STATIC_PAGE_UPDATED: "Halaman statis diubah",
  STATIC_PAGE_RESET: "Halaman statis dikembalikan",
  REVIEW_FIRST: "Tinjau dulu",
  AUTO_SEND: "Balas otomatis",
  PAID: "Lunas",
  LONG_LIVED: "Jangka panjang",
  SHORT_LIVED: "Jangka pendek",
  USER_LOGIN: "Masuk dari aplikasi",
  USER_PAIRING: "Dipasangkan dengan kode",
  BANK_TRANSFER: "Transfer bank",
  EWALLET: "E-wallet",
  QRIS: "QRIS",
  SUPPORT_READ: "Dukungan (lihat)",
  SUPPORT_REPLY: "Dukungan (balas)",
  MODERATION_REVIEW: "Moderasi",
  CONTENT_DRAFT: "Draft konten",
};

export function statusLabel(key: string | null | undefined) {
  if (!key) return "—";
  return STATUS_LABELS[key] ?? key;
}
