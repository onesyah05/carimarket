import "server-only";
import { Prisma, type Transaction, type User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { createNotification } from "@/server/notifications/service";
import { getQuotaSnapshot } from "@/server/usage/limits";
import { describeQuota } from "@/server/plans/queries";
import { listActivePaymentMethods, type PublicPaymentMethod } from "./payment-methods";
import {
  OPEN_TRANSACTION_STATUSES,
  PAYMENT_WINDOW_HOURS,
  PERIOD_CHOICES,
  buildInvoiceNumber,
  computeAmounts,
  paymentChannelLabel,
  paymentExpiryFrom,
  pickUniqueCode,
  resolveBillingPeriod,
  transactionStatusLabel,
} from "./pricing";
import { PLAN_CATALOG } from "../../../prisma/plan-catalog";

/**
 * Tagihan upgrade paket dan verifikasinya.
 *
 * Pembayaran belum melalui payment gateway, jadi alurnya dibuat jujur:
 * pelanggan memilih paket dan metode, menerima nominal berkode unik, menandai
 * sudah membayar, lalu Superadmin memverifikasi mutasi. Langganan hanya
 * berubah pada langkah verifikasi, dan perubahannya atomik bersama status
 * tagihan agar paket tidak pernah aktif tanpa jejak pembayaran.
 */

const ACTIVE_SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE"] as const;

export const createTransactionSchema = z.object({
  planId: z.string().trim().min(1, "Paket belum dipilih."),
  paymentMethodId: z.string().trim().min(1, "Metode pembayaran belum dipilih."),
  periodMonths: z.number().int().refine(value => (PERIOD_CHOICES as readonly number[]).includes(value), {
    message: `Durasi hanya dapat ${PERIOD_CHOICES.join(", ")} bulan.`,
  }),
});

export const confirmPaymentSchema = z.object({
  payerName: z.string().trim().min(2, "Nama pengirim minimal 2 karakter.").max(120),
  payerNote: z.string().trim().max(500).optional().or(z.literal("")),
});

export const reviewTransactionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
export type ReviewTransactionInput = z.infer<typeof reviewTransactionSchema>;

export type BillingTransaction = {
  id: string;
  invoiceNumber: string;
  status: Transaction["status"];
  statusLabel: string;
  planCode: string;
  planName: string;
  periodMonths: number;
  baseAmount: number;
  uniqueCode: number;
  totalAmount: number;
  paymentMethod: PublicPaymentMethod | null;
  payerName: string | null;
  payerNote: string | null;
  reviewNote: string | null;
  expiresAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  open: boolean;
};

export type UpgradeOption = {
  id: string;
  code: string;
  name: string;
  monthlyPrice: number;
  highlights: string[];
  current: boolean;
};

export type BillingOverview = {
  /** Paket yang kuotanya sedang berlaku, termasuk bila berasal dari paket bawaan. */
  currentPlan: { code: string; name: string; monthlyPrice: number; source: "subscription" | "default" } | null;
  subscription: { status: Transaction["status"] | string; statusLabel: string; currentPeriodEnd: string } | null;
  options: UpgradeOption[];
  paymentMethods: PublicPaymentMethod[];
  openTransaction: BillingTransaction | null;
  history: BillingTransaction[];
  paymentWindowHours: number;
  periodChoices: number[];
};

const withRelations = { plan: { select: { code: true, name: true } }, paymentMethod: true } as const;

type TransactionWithRelations = Prisma.TransactionGetPayload<{ include: typeof withRelations }>;

function serialize(transaction: TransactionWithRelations): BillingTransaction {
  const method = transaction.paymentMethod;
  return {
    id: transaction.id,
    invoiceNumber: transaction.invoiceNumber,
    status: transaction.status,
    statusLabel: transactionStatusLabel(transaction.status),
    planCode: transaction.plan.code,
    planName: transaction.plan.name,
    periodMonths: transaction.periodMonths,
    baseAmount: Number(transaction.baseAmount),
    uniqueCode: transaction.uniqueCode,
    totalAmount: Number(transaction.totalAmount),
    paymentMethod: method
      ? {
        id: method.id,
        channel: method.channel,
        channelLabel: paymentChannelLabel(method.channel),
        label: method.label,
        accountName: method.accountName,
        accountNumber: method.accountNumber,
        instructions: method.instructions,
      }
      : null,
    payerName: transaction.payerName,
    payerNote: transaction.payerNote,
    reviewNote: transaction.reviewNote,
    expiresAt: transaction.expiresAt.toISOString(),
    submittedAt: transaction.submittedAt?.toISOString() ?? null,
    reviewedAt: transaction.reviewedAt?.toISOString() ?? null,
    createdAt: transaction.createdAt.toISOString(),
    open: transaction.status === "PENDING" || transaction.status === "REVIEW",
  };
}

/**
 * Menandai tagihan yang melewati jendela pembayaran sebagai kedaluwarsa.
 *
 * Dipanggil sebelum setiap pembacaan daftar dan oleh worker, sehingga status
 * yang dilihat pelanggan maupun Superadmin selalu mutakhir tanpa penjadwalan
 * terpisah. Tagihan berstatus REVIEW tidak pernah kedaluwarsa karena
 * pelanggan sudah mengaku membayar dan sedang menunggu verifikasi.
 */
export async function expireDueTransactions() {
  const result = await prisma.transaction.updateMany({
    where: { status: "PENDING", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });
  return { transactionsExpired: result.count };
}

export async function getBillingOverview(userId: string): Promise<BillingOverview> {
  await expireDueTransactions();

  const [quota, subscription, plans, paymentMethods, transactions] = await Promise.all([
    getQuotaSnapshot(userId),
    prisma.subscription.findFirst({
      where: { userId, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { code: true, name: true, monthlyPrice: true } } },
    }),
    prisma.plan.findMany({ where: { isActive: true, monthlyPrice: { gt: 0 } }, orderBy: { monthlyPrice: "asc" } }),
    listActivePaymentMethods(),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: withRelations,
    }),
  ]);

  const serialized = transactions.map(serialize);
  const activeCode = subscription?.plan.code ?? null;

  return {
    currentPlan: quota.plan
      ? {
        code: quota.plan.code,
        name: quota.plan.name,
        monthlyPrice: subscription ? Number(subscription.plan.monthlyPrice) : 0,
        source: quota.plan.source,
      }
      : null,
    subscription: subscription
      ? {
        status: subscription.status,
        statusLabel: subscription.status === "ACTIVE" ? "Aktif" : subscription.status === "TRIAL" ? "Uji coba" : "Jatuh tempo",
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      }
      : null,
    options: plans.map(plan => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      monthlyPrice: Number(plan.monthlyPrice),
      highlights: PLAN_CATALOG.find(entry => entry.code === plan.code)?.highlights ?? describeQuota(plan),
      current: plan.code === activeCode,
    })),
    paymentMethods,
    openTransaction: serialized.find(item => item.open) ?? null,
    history: serialized,
    paymentWindowHours: PAYMENT_WINDOW_HOURS,
    periodChoices: [...PERIOD_CHOICES],
  };
}

export async function createTransaction(user: User, input: CreateTransactionInput) {
  await expireDueTransactions();

  const open = await prisma.transaction.findFirst({
    where: { userId: user.id, status: { in: [...OPEN_TRANSACTION_STATUSES] } },
    select: { invoiceNumber: true },
  });
  if (open) {
    throw new ThreadsIntegrationError(
      "TRANSACTION_OPEN",
      `Masih ada tagihan berjalan (${open.invoiceNumber}). Selesaikan atau batalkan tagihan tersebut sebelum membuat yang baru.`,
      409,
    );
  }

  const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
  if (!plan || !plan.isActive) throw new ThreadsIntegrationError("PLAN_NOT_FOUND", "Paket tidak ditemukan atau tidak aktif.", 404);
  const monthlyPrice = Number(plan.monthlyPrice);
  if (monthlyPrice <= 0) {
    throw new ThreadsIntegrationError("PLAN_NOT_PAYABLE", `Paket ${plan.name} gratis, jadi tidak memerlukan pembayaran.`, 400);
  }

  const method = await prisma.paymentMethod.findUnique({ where: { id: input.paymentMethodId } });
  if (!method || !method.isActive) {
    throw new ThreadsIntegrationError("PAYMENT_METHOD_NOT_FOUND", "Metode pembayaran tidak tersedia. Muat ulang halaman lalu pilih metode lain.", 404);
  }

  const now = new Date();
  const base = Math.round(monthlyPrice * input.periodMonths);
  const taken = await prisma.transaction.findMany({
    where: { status: { in: [...OPEN_TRANSACTION_STATUSES] }, baseAmount: new Prisma.Decimal(base) },
    select: { uniqueCode: true },
  });
  const uniqueCode = pickUniqueCode(taken.map(item => item.uniqueCode));
  const amounts = computeAmounts({ monthlyPrice, periodMonths: input.periodMonths, uniqueCode });

  const transaction = await createWithUniqueInvoice({
    userId: user.id,
    planId: plan.id,
    paymentMethodId: method.id,
    periodMonths: input.periodMonths,
    baseAmount: new Prisma.Decimal(amounts.baseAmount),
    uniqueCode,
    totalAmount: new Prisma.Decimal(amounts.totalAmount),
    expiresAt: paymentExpiryFrom(now),
  }, now);

  await recordAudit({
    actorId: user.id,
    action: "TRANSACTION_CREATED",
    entityType: "Transaction",
    entityId: transaction.id,
    metadata: { invoiceNumber: transaction.invoiceNumber, planCode: plan.code, totalAmount: amounts.totalAmount, periodMonths: input.periodMonths },
  });
  return serialize(transaction);
}

/**
 * Nomor tagihan memuat bagian acak, jadi tabrakan mungkin terjadi walau
 * jarang. Percobaan ulang singkat lebih baik daripada menggagalkan pembuatan
 * tagihan di depan pelanggan.
 */
async function createWithUniqueInvoice(data: Omit<Prisma.TransactionUncheckedCreateInput, "invoiceNumber">, now: Date) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.transaction.create({
        data: { ...data, invoiceNumber: buildInvoiceNumber(now) },
        include: withRelations,
      });
    } catch (error) {
      const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!duplicate || attempt === 4) throw error;
    }
  }
  throw new ThreadsIntegrationError("TRANSACTION_FAILED", "Tagihan belum dapat dibuat. Coba lagi sebentar lagi.", 503);
}

async function requireOwnTransaction(userId: string, transactionId: string) {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    include: withRelations,
  });
  if (!transaction) throw new ThreadsIntegrationError("TRANSACTION_NOT_FOUND", "Tagihan tidak ditemukan.", 404);
  return transaction;
}

/** Pelanggan menandai sudah membayar; tagihan masuk antrean verifikasi. */
export async function confirmPayment(user: User, transactionId: string, input: ConfirmPaymentInput) {
  const transaction = await requireOwnTransaction(user.id, transactionId);
  if (transaction.status !== "PENDING") {
    throw new ThreadsIntegrationError(
      "TRANSACTION_NOT_PENDING",
      `Tagihan ini berstatus ${transactionStatusLabel(transaction.status).toLowerCase()}, jadi tidak dapat dikonfirmasi lagi.`,
      409,
    );
  }

  const updated = await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: "REVIEW",
      payerName: input.payerName,
      payerNote: input.payerNote ? input.payerNote : null,
      submittedAt: new Date(),
    },
    include: withRelations,
  });

  await recordAudit({
    actorId: user.id,
    action: "TRANSACTION_SUBMITTED",
    entityType: "Transaction",
    entityId: transaction.id,
    metadata: { invoiceNumber: transaction.invoiceNumber, payerName: input.payerName },
  });
  return serialize(updated);
}

export async function cancelTransaction(user: User, transactionId: string) {
  const transaction = await requireOwnTransaction(user.id, transactionId);
  if (transaction.status !== "PENDING" && transaction.status !== "REVIEW") {
    throw new ThreadsIntegrationError("TRANSACTION_CLOSED", "Tagihan ini sudah selesai sehingga tidak dapat dibatalkan.", 409);
  }

  const updated = await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: "CANCELLED" },
    include: withRelations,
  });
  await recordAudit({
    actorId: user.id,
    action: "TRANSACTION_CANCELLED",
    entityType: "Transaction",
    entityId: transaction.id,
    metadata: { invoiceNumber: transaction.invoiceNumber },
  });
  return serialize(updated);
}

export type AdminTransaction = BillingTransaction & {
  user: { id: string; name: string; email: string };
  reviewedBy: string | null;
};

export type AdminTransactionList = {
  transactions: AdminTransaction[];
  counts: { review: number; pending: number; paidThisMonth: number; revenueThisMonth: number };
};

export async function listTransactionsForAdmin(): Promise<AdminTransactionList> {
  await expireDueTransactions();

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [transactions, review, pending, paid] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { ...withRelations, user: { select: { id: true, name: true, email: true } }, reviewedBy: { select: { name: true } } },
    }),
    prisma.transaction.count({ where: { status: "REVIEW" } }),
    prisma.transaction.count({ where: { status: "PENDING" } }),
    prisma.transaction.aggregate({
      where: { status: "PAID", reviewedAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    transactions: transactions.map(transaction => ({
      ...serialize(transaction),
      user: transaction.user,
      reviewedBy: transaction.reviewedBy?.name ?? null,
    })),
    counts: {
      review,
      pending,
      paidThisMonth: paid._count._all,
      revenueThisMonth: Number(paid._sum.totalAmount ?? 0),
    },
  };
}

/**
 * Verifikasi pembayaran oleh Superadmin.
 *
 * Menyetujui tagihan mengubah langganan dan status tagihan dalam satu
 * transaksi database, sehingga paket tidak mungkin aktif tanpa tagihan lunas
 * dan sebaliknya. Pembayaran untuk paket yang sama memperpanjang periode yang
 * sedang berjalan; pindah paket mengakhiri langganan lama karena kuotanya
 * langsung berganti.
 */
export async function reviewTransaction(actor: User, transactionId: string, input: ReviewTransactionInput) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: withRelations,
  });
  if (!transaction) throw new ThreadsIntegrationError("TRANSACTION_NOT_FOUND", "Tagihan tidak ditemukan.", 404);
  if (transaction.status !== "PENDING" && transaction.status !== "REVIEW") {
    throw new ThreadsIntegrationError("TRANSACTION_CLOSED", `Tagihan ini sudah berstatus ${transactionStatusLabel(transaction.status).toLowerCase()}.`, 409);
  }

  const now = new Date();
  const note = input.note ? input.note : null;

  if (input.action === "reject") {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: "REJECTED", reviewedAt: now, reviewedById: actor.id, reviewNote: note },
    });
    await recordAudit({
      actorId: actor.id,
      action: "TRANSACTION_REJECTED",
      entityType: "Transaction",
      entityId: transaction.id,
      metadata: { invoiceNumber: transaction.invoiceNumber, userId: transaction.userId },
    });
    await createNotification({
      userId: transaction.userId,
      type: "PAYMENT_UPDATE",
      title: `Pembayaran ${transaction.invoiceNumber} belum dapat diverifikasi`,
      body: note ?? "Pembayaran belum kami temukan pada mutasi. Periksa nominal beserta kode uniknya, lalu buat tagihan baru atau hubungi dukungan.",
      href: "/dashboard/langganan",
    });
    return { status: "REJECTED" as const };
  }

  const current = await prisma.subscription.findFirst({
    where: { userId: transaction.userId, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } },
    orderBy: { createdAt: "desc" },
  });
  const period = resolveBillingPeriod({
    now,
    months: transaction.periodMonths,
    planId: transaction.planId,
    current: current
      ? { planId: current.planId, currentPeriodStart: current.currentPeriodStart, currentPeriodEnd: current.currentPeriodEnd }
      : null,
  });

  const subscriptionId = await prisma.$transaction(async tx => {
    // Mengunci tagihan pada status yang sudah dibaca: dua Superadmin yang
    // menyetujui tagihan sama secara bersamaan tidak boleh menambah periode
    // dua kali.
    const claimed = await tx.transaction.updateMany({
      where: { id: transaction.id, status: transaction.status },
      data: { status: "PAID", reviewedAt: now, reviewedById: actor.id, reviewNote: note },
    });
    if (claimed.count === 0) {
      throw new ThreadsIntegrationError("TRANSACTION_CLOSED", "Tagihan ini baru saja diproses oleh akun lain.", 409);
    }

    const subscription = period.extended && current
      ? await tx.subscription.update({
        where: { id: current.id },
        data: { status: "ACTIVE", currentPeriodEnd: period.end, cancelledAt: null },
      })
      : await replaceSubscription(tx, { current, transaction, period, now });

    await tx.transaction.update({ where: { id: transaction.id }, data: { subscriptionId: subscription.id } });
    return subscription.id;
  });

  await recordAudit({
    actorId: actor.id,
    action: "TRANSACTION_APPROVED",
    entityType: "Transaction",
    entityId: transaction.id,
    metadata: {
      invoiceNumber: transaction.invoiceNumber,
      userId: transaction.userId,
      planCode: transaction.plan.code,
      subscriptionId,
      totalAmount: Number(transaction.totalAmount),
      extended: period.extended,
    },
  });

  await createNotification({
    userId: transaction.userId,
    type: "PAYMENT_UPDATE",
    title: `Paket ${transaction.plan.name} aktif`,
    body: `Pembayaran ${transaction.invoiceNumber} terverifikasi. Kuota paket ${transaction.plan.name} berlaku sampai ${formatPeriodEnd(period.end)}.`,
    href: "/dashboard/langganan",
  });

  return { status: "PAID" as const, subscriptionId, periodEnd: period.end.toISOString() };
}

type SubscriptionRow = Awaited<ReturnType<typeof prisma.subscription.findFirst>>;

/**
 * Mengakhiri langganan lama lalu membuka langganan baru.
 *
 * Dipakai saat pelanggan pindah paket atau langganannya sudah lewat periode,
 * karena kuota yang berlaku langsung mengikuti paket yang baru dibayar.
 */
async function replaceSubscription(tx: Prisma.TransactionClient, input: {
  current: SubscriptionRow;
  transaction: TransactionWithRelations;
  period: { start: Date; end: Date };
  now: Date;
}) {
  if (input.current) {
    await tx.subscription.update({
      where: { id: input.current.id },
      data: { status: "CANCELLED", cancelledAt: input.now },
    });
  }
  return tx.subscription.create({
    data: {
      userId: input.transaction.userId,
      planId: input.transaction.planId,
      status: "ACTIVE",
      currentPeriodStart: input.period.start,
      currentPeriodEnd: input.period.end,
      providerReference: input.transaction.invoiceNumber,
    },
  });
}

function formatPeriodEnd(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(value);
}
