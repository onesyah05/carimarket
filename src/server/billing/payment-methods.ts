import "server-only";
import type { PaymentMethod, User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { OPEN_TRANSACTION_STATUSES, paymentChannelLabel } from "./pricing";
import { detectQrImageType, QR_MAX_BYTES, QR_TYPE_LABELS } from "./qr-image";

/**
 * Metode pembayaran yang dikelola Superadmin.
 *
 * Isi tabel ini tampil apa adanya sebagai instruksi transfer kepada pelanggan,
 * jadi hanya Superadmin yang boleh mengubahnya. Metode yang pernah dipakai
 * tagihan tidak dihapus melainkan dinonaktifkan supaya histori pembayaran
 * tetap dapat dibaca.
 */

/**
 * Saluran yang masih boleh dibuat.
 *
 * `BANK_TRANSFER` sengaja tidak ada di sini meski nilainya tetap hidup di
 * enum basis data: tagihan lama yang memakai transfer bank harus tetap dapat
 * dibaca di histori, yang berhenti hanyalah pembuatan metode bank yang baru.
 */
export const SELECTABLE_CHANNELS = ["QRIS", "EWALLET"] as const;

const fields = {
  channel: z.enum(SELECTABLE_CHANNELS),
  label: z.string().trim().min(2, "Nama metode minimal 2 karakter.").max(80),
  accountName: z.string().trim().min(2, "Nama pemilik akun minimal 2 karakter.").max(120),
  // Tanpa batas bawah di sini: QRIS tidak punya nomor tujuan, dan aturannya
  // ditegakkan di bawah supaya pesannya menyebut saluran yang bersangkutan.
  accountNumber: z.string().trim().max(80),
  instructions: z.string().trim().max(1_000).optional().or(z.literal("")),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
};

export const paymentMethodSchema = z.object(fields).superRefine((value, ctx) => {
  // Yang dibayar pada QRIS adalah gambarnya, bukan sebuah nomor. Memaksa
  // nomor tujuan di sana membuat Superadmin mengarang isian — dan karangan
  // itu tampil apa adanya kepada pelanggan sebagai instruksi pembayaran.
  if (value.channel !== "QRIS" && value.accountNumber.length < 2) {
    ctx.addIssue({ code: "custom", path: ["accountNumber"], message: "Nomor tujuan minimal 2 karakter." });
  }
});
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;

export type PublicPaymentMethod = {
  id: string;
  channel: PaymentMethod["channel"];
  channelLabel: string;
  label: string;
  accountName: string;
  accountNumber: string;
  instructions: string | null;
  /** Alamat gambar QR, atau null bila metode ini tidak punya. */
  qrImageUrl: string | null;
};

export type AdminPaymentMethod = PublicPaymentMethod & {
  isActive: boolean;
  sortOrder: number;
  transactions: number;
};

/**
 * Hanya `updatedAt` yang diambil dari relasi gambar, tidak pernah isinya.
 * Blob-nya dibaca sekali saat gambarnya benar-benar diminta.
 */
const withQrStamp = { qr: { select: { updatedAt: true } } } as const;

type MethodWithQrStamp = PaymentMethod & { qr?: { updatedAt: Date } | null };

function serialize(method: MethodWithQrStamp): PublicPaymentMethod {
  return {
    id: method.id,
    channel: method.channel,
    channelLabel: paymentChannelLabel(method.channel),
    label: method.label,
    accountName: method.accountName,
    accountNumber: method.accountNumber,
    instructions: method.instructions,
    qrImageUrl: qrImageUrl(method),
  };
}

/**
 * Cap waktu ikut di URL supaya mengganti gambar langsung terlihat. Tanpa itu
 * peramban menahan gambar lama di cache, dan QR yang kedaluwarsa adalah
 * pembayaran yang masuk ke tempat yang salah.
 */
export function qrImageUrl(method: MethodWithQrStamp): string | null {
  if (!method.qr) return null;
  return `/api/pembayaran/metode/${encodeURIComponent(method.id)}/qris?v=${method.qr.updatedAt.getTime()}`;
}

function toData(input: PaymentMethodInput) {
  return {
    channel: input.channel,
    label: input.label,
    accountName: input.accountName,
    accountNumber: input.accountNumber,
    instructions: input.instructions ? input.instructions : null,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };
}

/** Metode yang dapat dipilih pelanggan saat membuat tagihan. */
export async function listActivePaymentMethods(): Promise<PublicPaymentMethod[]> {
  const methods = await prisma.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    include: withQrStamp,
  });
  return methods.map(serialize);
}

export async function listPaymentMethodsForAdmin(): Promise<AdminPaymentMethod[]> {
  const methods = await prisma.paymentMethod.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
    include: { ...withQrStamp, _count: { select: { transactions: true } } },
  });
  return methods.map(method => ({
    ...serialize(method),
    isActive: method.isActive,
    sortOrder: method.sortOrder,
    transactions: method._count.transactions,
  }));
}

/**
 * Nilai form multipart menjadi objek yang dibaca skema.
 *
 * Form dipakai alih-alih JSON karena metode dan gambar QR-nya harus tersimpan
 * sebagai satu tindakan: metode QRIS yang aktif tanpa gambar tidak dapat
 * dibayar sama sekali, jadi keadaan itu tidak boleh sempat ada.
 */
export function paymentMethodFormValues(form: FormData) {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    channel: text("channel"),
    label: text("label"),
    accountName: text("accountName"),
    accountNumber: text("accountNumber"),
    instructions: text("instructions"),
    isActive: text("isActive") === "true",
    sortOrder: Number(text("sortOrder")) || 0,
  };
}

/** Berkas QR dari form, atau null bila Superadmin tidak memilih yang baru. */
export function paymentMethodFormFile(form: FormData): File | null {
  const file = form.get("qris");
  return file instanceof File && file.size > 0 ? file : null;
}

/**
 * Memeriksa berkas sebelum apa pun ditulis.
 *
 * Isi berkas dibaca untuk menentukan jenisnya; nama dan `Content-Type`
 * kiriman tidak dipercaya karena keduanya dapat dipalsukan, dan gambar ini
 * ditampilkan kepada tiap pelanggan yang membuka tagihan.
 */
async function prepareQrImage(file: File) {
  if (file.size > QR_MAX_BYTES) throw new ThreadsIntegrationError("QR_TOO_LARGE", "Ukuran gambar QR maksimal 2 MB.", 400);

  const content = Buffer.from(await file.arrayBuffer());
  if (content.byteLength === 0) throw new ThreadsIntegrationError("QR_EMPTY", "Berkas gambar QR kosong.", 400);

  const type = detectQrImageType(new Uint8Array(content));
  if (!type) throw new ThreadsIntegrationError("QR_TYPE_REJECTED", `Gambar QR harus berupa ${QR_TYPE_LABELS}.`, 400);

  return { content, mimeType: type.mime, size: content.byteLength };
}

/**
 * QRIS yang aktif wajib bergambar.
 *
 * Pada saluran lain pelanggan masih bisa membayar dengan nomor tujuan, tetapi
 * QRIS tanpa gambar tidak menyisakan apa pun untuk dibayar — hanya tagihan
 * yang tidak mungkin diselesaikan.
 */
function assertQrPresent(input: PaymentMethodInput, hasImage: boolean) {
  if (input.channel === "QRIS" && input.isActive && !hasImage) {
    throw new ThreadsIntegrationError("QR_REQUIRED", "Metode QRIS yang aktif harus dilengkapi gambar QR.", 400);
  }
}

export async function createPaymentMethod(actor: User, input: PaymentMethodInput, qrFile: File | null = null) {
  assertQrPresent(input, qrFile !== null);
  // Berkasnya diperiksa lebih dulu agar gambar yang ditolak tidak meninggalkan
  // metode QRIS yang terlanjur dibuat tanpa gambar.
  const image = qrFile ? await prepareQrImage(qrFile) : null;

  const method = await prisma.paymentMethod.create({
    data: { ...toData(input), ...(image ? { qr: { create: image } } : {}) },
  });
  await recordAudit({
    actorId: actor.id,
    action: "PAYMENT_METHOD_CREATED",
    entityType: "PaymentMethod",
    entityId: method.id,
    metadata: { channel: method.channel, label: method.label },
  });
  return method;
}

export async function updatePaymentMethod(actor: User, methodId: string, input: PaymentMethodInput, qrFile: File | null = null) {
  const existing = await prisma.paymentMethod.findUnique({ where: { id: methodId }, select: { id: true } });
  if (!existing) throw new ThreadsIntegrationError("PAYMENT_METHOD_NOT_FOUND", "Metode pembayaran tidak ditemukan.", 404);

  // Menonaktifkan metode saat masih ada tagihan terbuka akan membuat
  // pelanggan kehilangan instruksi transfer yang sedang mereka ikuti.
  if (!input.isActive) await assertNoOpenTransactions(methodId);

  const current = await prisma.paymentMethodQr.findUnique({ where: { paymentMethodId: methodId }, select: { paymentMethodId: true } });
  assertQrPresent(input, qrFile !== null || current !== null);
  const image = qrFile ? await prepareQrImage(qrFile) : null;

  const method = await prisma.paymentMethod.update({
    where: { id: methodId },
    data: {
      ...toData(input),
      // Tanpa berkas baru, gambar yang sudah ada dibiarkan apa adanya:
      // menyimpan perubahan nama atau urutan tidak boleh menghapus QR-nya.
      ...(image ? { qr: { upsert: { create: image, update: image } } } : {}),
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "PAYMENT_METHOD_UPDATED",
    entityType: "PaymentMethod",
    entityId: methodId,
    metadata: { channel: method.channel, label: method.label, isActive: method.isActive },
  });
  return method;
}

export async function deletePaymentMethod(actor: User, methodId: string) {
  const method = await prisma.paymentMethod.findUnique({
    where: { id: methodId },
    include: { _count: { select: { transactions: true } } },
  });
  if (!method) throw new ThreadsIntegrationError("PAYMENT_METHOD_NOT_FOUND", "Metode pembayaran tidak ditemukan.", 404);
  if (method._count.transactions > 0) {
    throw new ThreadsIntegrationError(
      "PAYMENT_METHOD_IN_USE",
      `Metode ini dipakai ${method._count.transactions} tagihan dalam histori. Nonaktifkan metode alih-alih menghapusnya.`,
      409,
    );
  }

  await prisma.paymentMethod.delete({ where: { id: methodId } });
  await recordAudit({
    actorId: actor.id,
    action: "PAYMENT_METHOD_DELETED",
    entityType: "PaymentMethod",
    entityId: methodId,
    metadata: { label: method.label },
  });
  return { label: method.label };
}

async function assertNoOpenTransactions(methodId: string) {
  const open = await prisma.transaction.count({
    where: { paymentMethodId: methodId, status: { in: [...OPEN_TRANSACTION_STATUSES] } },
  });
  if (open > 0) {
    throw new ThreadsIntegrationError(
      "PAYMENT_METHOD_IN_USE",
      `Masih ada ${open} tagihan terbuka yang memakai metode ini. Selesaikan atau tolak tagihan tersebut lebih dulu.`,
      409,
    );
  }
}

/** Isi gambar QR; satu-satunya tempat blob-nya benar-benar dibaca. */
export async function readPaymentMethodQr(methodId: string) {
  const qr = await prisma.paymentMethodQr.findUnique({ where: { paymentMethodId: methodId } });
  if (!qr) throw new ThreadsIntegrationError("QR_NOT_FOUND", "Metode ini belum punya gambar QR.", 404);
  return qr;
}
