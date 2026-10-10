import type { PaymentChannel, TransactionStatus } from "@prisma/client";

/**
 * Perhitungan tagihan upgrade.
 *
 * Modul ini murni agar aturan uang dapat diuji tanpa database: nominal akhir,
 * kode unik pencocokan mutasi, nomor tagihan, dan periode langganan yang
 * dihasilkan sebuah pembayaran.
 */

/** Tagihan yang belum dibayar kedaluwarsa setelah jendela ini. */
export const PAYMENT_WINDOW_HOURS = 24;

/** Durasi berlangganan yang dapat dipilih pelanggan, dalam bulan. */
export const PERIOD_CHOICES = [1, 3, 6, 12] as const;

export const MIN_UNIQUE_CODE = 1;
export const MAX_UNIQUE_CODE = 999;

/** Status yang masih menunggu tindakan; hanya satu yang boleh terbuka per akun. */
export const OPEN_TRANSACTION_STATUSES = ["PENDING", "REVIEW"] as const satisfies TransactionStatus[];

export function isOpenStatus(status: TransactionStatus) {
  return (OPEN_TRANSACTION_STATUSES as readonly TransactionStatus[]).includes(status);
}

const STATUS_LABEL: Record<TransactionStatus, string> = {
  PENDING: "Menunggu pembayaran",
  REVIEW: "Menunggu verifikasi",
  PAID: "Lunas",
  REJECTED: "Ditolak",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
};

const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  BANK_TRANSFER: "Transfer bank",
  EWALLET: "E-wallet",
  QRIS: "QRIS",
};

export function transactionStatusLabel(status: TransactionStatus) {
  return STATUS_LABEL[status];
}

export function paymentChannelLabel(channel: PaymentChannel) {
  return CHANNEL_LABEL[channel];
}

/**
 * Nominal tagihan.
 *
 * Kode unik ditambahkan ke nominal, bukan disimpan terpisah, supaya satu
 * mutasi bank hanya cocok dengan satu tagihan dan verifikasi manual tidak
 * perlu menebak milik siapa sebuah transfer.
 */
export function computeAmounts(input: { monthlyPrice: number; periodMonths: number; uniqueCode: number }) {
  const baseAmount = Math.round(input.monthlyPrice * input.periodMonths);
  return { baseAmount, totalAmount: baseAmount + input.uniqueCode };
}

/**
 * Memilih kode unik yang belum dipakai tagihan terbuka lain dengan nominal
 * dasar yang sama. Bila seluruh kode sedang terpakai, kode acak tetap
 * dikembalikan agar pembuatan tagihan tidak pernah terhenti; pencocokan
 * manual saat itu dibantu nomor tagihan.
 */
export function pickUniqueCode(taken: readonly number[], random: () => number = Math.random) {
  const used = new Set(taken);
  const available: number[] = [];
  for (let code = MIN_UNIQUE_CODE; code <= MAX_UNIQUE_CODE; code += 1) {
    if (!used.has(code)) available.push(code);
  }
  if (available.length === 0) return MIN_UNIQUE_CODE + Math.floor(random() * MAX_UNIQUE_CODE);
  return available[Math.floor(random() * available.length)];
}

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Tanggal di zona Jakarta, dipakai agar nomor tagihan sesuai hari pelanggan. */
export function jakartaDateStamp(now: Date) {
  const shifted = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = `${shifted.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${shifted.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

/** Nomor tagihan yang dapat disebut pelanggan, mis. INV-20261011-7K3M. */
export function buildInvoiceNumber(now: Date, random: () => number = Math.random) {
  const suffix = Math.floor(random() * 36 ** 4).toString(36).toUpperCase().padStart(4, "0");
  return `INV-${jakartaDateStamp(now)}-${suffix}`;
}

/**
 * Menambah bulan kalender dan menjepit tanggal yang tidak ada.
 * 31 Januari ditambah satu bulan menjadi 28 atau 29 Februari, bukan 3 Maret.
 */
export function addMonths(date: Date, months: number) {
  const result = new Date(date.getTime());
  const targetDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const daysInTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(targetDay, daysInTargetMonth));
  return result;
}

export type CurrentPeriod = { planId: string; currentPeriodStart: Date; currentPeriodEnd: Date } | null;

/**
 * Periode langganan setelah sebuah pembayaran diverifikasi.
 *
 * Pembayaran untuk paket yang sama memperpanjang periode yang sedang berjalan
 * sehingga sisa masa aktif tidak hangus. Pindah paket dimulai dari sekarang
 * karena kuota yang berlaku langsung berubah.
 */
export function resolveBillingPeriod(input: { now: Date; months: number; planId: string; current: CurrentPeriod }) {
  const { now, months, planId, current } = input;
  const extendable = current !== null && current.planId === planId && current.currentPeriodEnd.getTime() > now.getTime();
  if (extendable && current) {
    return { start: current.currentPeriodStart, end: addMonths(current.currentPeriodEnd, months), extended: true };
  }
  return { start: now, end: addMonths(now, months), extended: false };
}

export function paymentExpiryFrom(now: Date) {
  return new Date(now.getTime() + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000);
}
