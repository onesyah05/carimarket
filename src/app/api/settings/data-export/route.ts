import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSettingsUser();
    const data = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        email: true,
        name: true,
        createdAt: true,
        businessProfile: { select: { name: true, category: true, description: true, location: true, serviceArea: true, brandVoice: true } },
        notification: { select: { emailLead: true, emailReply: true, emailQuota: true, pushEnabled: true } },
        replyAutomation: { select: { mode: true, minimumScore: true, dailyLimit: true, delayMinutes: true, pauseOnRisk: true, quietHoursEnabled: true, quietHoursStart: true, quietHoursEnd: true } },
        keywords: { select: { phrase: true, kind: true, isActive: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        leads: { select: { status: true, relevanceScore: true, matchReason: true, discoveredAt: true, threadPost: { select: { authorHandle: true, body: true, permalink: true, postedAt: true } } }, orderBy: { discoveredAt: "desc" } },
        replyDrafts: { select: { body: true, status: true, deliveryMode: true, scheduledFor: true, sentAt: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        subscriptions: { select: { status: true, currentPeriodStart: true, currentPeriodEnd: true, plan: { select: { name: true, code: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2);
    const filename = `cari-market-data-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
