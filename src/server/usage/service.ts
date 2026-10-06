import "server-only";
import { prisma } from "@/lib/prisma";

export type UsageType = "SEARCH" | "REPLY";

function periodStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function recordUsage(userId: string, type: UsageType, units = 1, referenceId?: string) {
  await prisma.usageEvent.create({
    data: { userId, type, units, referenceId: referenceId ?? null, occurredAt: new Date() },
  }).catch(() => undefined);

  const period = periodStart();
  if (type === "SEARCH") {
    await prisma.monthlyUsage.upsert({
      where: { userId_periodStart: { userId, periodStart: period } },
      update: { searchCount: { increment: units } },
      create: { userId, periodStart: period, searchCount: units, replyCount: 0 },
    }).catch(() => undefined);
  } else {
    await prisma.monthlyUsage.upsert({
      where: { userId_periodStart: { userId, periodStart: period } },
      update: { replyCount: { increment: units } },
      create: { userId, periodStart: period, searchCount: 0, replyCount: units },
    }).catch(() => undefined);
  }
}
