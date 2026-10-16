import "server-only";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { OPEN_TRANSACTION_STATUSES } from "./pricing";

/**
 * Mengaktifkan paket gratis sebagai langganan.
 *
 * Paket berbayar melewati tagihan dan verifikasi manual; paket gratis tidak
 * punya apa pun untuk diverifikasi, jadi langganannya dibuat langsung. Ini
 * sekaligus menjaga agar kewajiban memilih paket tidak berubah menjadi
 * tembok: selalu ada jalan masuk yang terbuka seketika.
 */

const ACTIVE_SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE"] as const;

/**
 * Periode paket gratis. Tidak ada penagihan berulang yang memperpanjangnya,
 * jadi angka ini hanya menentukan tanggal yang ditampilkan — dibuat panjang
 * supaya tidak tampil seolah akan kedaluwarsa bulan depan.
 */
const FREE_PERIOD_MONTHS = 12;

export async function findFreePlan() {
  return prisma.plan.findFirst({
    where: { isActive: true, monthlyPrice: 0 },
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true, name: true, monthlySearchLimit: true, monthlyReplyLimit: true, keywordLimit: true },
  });
}

export async function startFreePlan(user: User) {
  const existing = await prisma.subscription.findFirst({
    where: { userId: user.id, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } },
    select: { id: true },
  });
  if (existing) {
    throw new ThreadsIntegrationError("SUBSCRIPTION_ACTIVE", "Anda sudah memiliki langganan aktif.", 409);
  }

  const open = await prisma.transaction.findFirst({
    where: { userId: user.id, status: { in: [...OPEN_TRANSACTION_STATUSES] } },
    select: { invoiceNumber: true },
  });
  if (open) {
    throw new ThreadsIntegrationError(
      "TRANSACTION_OPEN",
      `Masih ada tagihan berjalan (${open.invoiceNumber}). Batalkan tagihan itu dulu bila ingin memakai paket gratis.`,
      409,
    );
  }

  const plan = await findFreePlan();
  if (!plan) {
    throw new ThreadsIntegrationError(
      "FREE_PLAN_UNAVAILABLE",
      "Paket gratis sedang tidak tersedia. Silakan pilih paket berbayar.",
      409,
    );
  }

  const start = new Date();
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + FREE_PERIOD_MONTHS);

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodStart: start,
      currentPeriodEnd: end,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: user.id,
    action: "SUBSCRIPTION_FREE_STARTED",
    entityType: "Subscription",
    entityId: subscription.id,
    metadata: { planCode: plan.code },
  });

  return { planCode: plan.code, planName: plan.name };
}
