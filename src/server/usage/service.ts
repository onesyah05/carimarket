import "server-only";
import { prisma } from "@/lib/prisma";
// Periode penagihan dipakai bersama penegakan kuota; jangan didefinisikan ulang
// di sini agar penghitung dan pemeriksa selalu membaca baris yang sama.
import { currentPeriodStart } from "./quota";

export type UsageType = "SEARCH" | "REPLY";

/**
 * Kegagalan pencatatan tidak boleh menggagalkan aksi pengguna, tetapi juga
 * tidak boleh hilang tanpa jejak: kuota yang tidak tercatat berarti batas
 * paket tidak tertegakkan.
 */
function warnUsageFailure(type: UsageType, scope: string, error: unknown) {
  const reason = error instanceof Error ? error.message.slice(0, 200) : "penyebab tidak diketahui";
  console.warn(`Pencatatan pemakaian ${type} gagal pada ${scope}: ${reason}`);
}

export async function recordUsage(userId: string, type: UsageType, units = 1, referenceId?: string) {
  await prisma.usageEvent.create({
    data: { userId, type, units, referenceId: referenceId ?? null, occurredAt: new Date() },
  }).catch(error => warnUsageFailure(type, "UsageEvent", error));

  const period = currentPeriodStart();
  if (type === "SEARCH") {
    await prisma.monthlyUsage.upsert({
      where: { userId_periodStart: { userId, periodStart: period } },
      update: { searchCount: { increment: units } },
      create: { userId, periodStart: period, searchCount: units, replyCount: 0 },
    }).catch(error => warnUsageFailure(type, "MonthlyUsage", error));
  } else {
    await prisma.monthlyUsage.upsert({
      where: { userId_periodStart: { userId, periodStart: period } },
      update: { replyCount: { increment: units } },
      create: { userId, periodStart: period, searchCount: 0, replyCount: units },
    }).catch(error => warnUsageFailure(type, "MonthlyUsage", error));
  }
}
