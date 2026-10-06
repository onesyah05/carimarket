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
  SUPPORT_READ: "Dukungan (lihat)",
  SUPPORT_REPLY: "Dukungan (balas)",
  MODERATION_REVIEW: "Moderasi",
  CONTENT_DRAFT: "Draft konten",
};

export function statusLabel(key: string | null | undefined) {
  if (!key) return "—";
  return STATUS_LABELS[key] ?? key;
}
