import "server-only";
import type { PaymentMethod, User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { OPEN_TRANSACTION_STATUSES, paymentChannelLabel } from "./pricing";

/**
 * Metode pembayaran yang dikelola Superadmin.
 *
 * Isi tabel ini tampil apa adanya sebagai instruksi transfer kepada pelanggan,
 * jadi hanya Superadmin yang boleh mengubahnya. Metode yang pernah dipakai
 * tagihan tidak dihapus melainkan dinonaktifkan supaya histori pembayaran
 * tetap dapat dibaca.
 */

const fields = {
  channel: z.enum(["BANK_TRANSFER", "EWALLET", "QRIS"]),
  label: z.string().trim().min(2, "Nama metode minimal 2 karakter.").max(80),
  accountName: z.string().trim().min(2, "Nama pemilik akun minimal 2 karakter.").max(120),
  accountNumber: z.string().trim().min(2, "Nomor tujuan minimal 2 karakter.").max(80),
  instructions: z.string().trim().max(1_000).optional().or(z.literal("")),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
};

export const paymentMethodSchema = z.object(fields);
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;

export type PublicPaymentMethod = {
  id: string;
  channel: PaymentMethod["channel"];
  channelLabel: string;
  label: string;
  accountName: string;
  accountNumber: string;
  instructions: string | null;
};

export type AdminPaymentMethod = PublicPaymentMethod & {
  isActive: boolean;
  sortOrder: number;
  transactions: number;
};

function serialize(method: PaymentMethod): PublicPaymentMethod {
  return {
    id: method.id,
    channel: method.channel,
    channelLabel: paymentChannelLabel(method.channel),
    label: method.label,
    accountName: method.accountName,
    accountNumber: method.accountNumber,
    instructions: method.instructions,
  };
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
  });
  return methods.map(serialize);
}

export async function listPaymentMethodsForAdmin(): Promise<AdminPaymentMethod[]> {
  const methods = await prisma.paymentMethod.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
    include: { _count: { select: { transactions: true } } },
  });
  return methods.map(method => ({
    ...serialize(method),
    isActive: method.isActive,
    sortOrder: method.sortOrder,
    transactions: method._count.transactions,
  }));
}

export async function createPaymentMethod(actor: User, input: PaymentMethodInput) {
  const method = await prisma.paymentMethod.create({ data: toData(input) });
  await recordAudit({
    actorId: actor.id,
    action: "PAYMENT_METHOD_CREATED",
    entityType: "PaymentMethod",
    entityId: method.id,
    metadata: { channel: method.channel, label: method.label },
  });
  return method;
}

export async function updatePaymentMethod(actor: User, methodId: string, input: PaymentMethodInput) {
  const existing = await prisma.paymentMethod.findUnique({ where: { id: methodId }, select: { id: true } });
  if (!existing) throw new ThreadsIntegrationError("PAYMENT_METHOD_NOT_FOUND", "Metode pembayaran tidak ditemukan.", 404);

  // Menonaktifkan metode saat masih ada tagihan terbuka akan membuat
  // pelanggan kehilangan instruksi transfer yang sedang mereka ikuti.
  if (!input.isActive) await assertNoOpenTransactions(methodId);

  const method = await prisma.paymentMethod.update({ where: { id: methodId }, data: toData(input) });
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
