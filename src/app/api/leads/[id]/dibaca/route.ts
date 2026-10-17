import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { requireWorkspaceContext } from "@/server/workspace/context";

export const runtime = "nodejs";

/**
 * POST — menandai satu lead sudah dibaca.
 *
 * Penandaannya sekali jalan: membuka lead yang sama berkali-kali tidak
 * menggeser waktu bacanya, sehingga "kapan pertama dilihat" tetap jujur.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    const { profile } = await requireWorkspaceContext();
    const { id } = await params;

    const updated = await prisma.lead.updateMany({
      where: { id, businessProfileId: profile.id, viewedAt: null },
      data: { viewedAt: new Date() },
    });
    if (updated.count === 0) {
      const exists = await prisma.lead.findFirst({ where: { id, businessProfileId: profile.id }, select: { viewedAt: true } });
      if (!exists) throw new ThreadsIntegrationError("LEAD_NOT_FOUND", "Lead tidak ditemukan.", 404);
      return NextResponse.json({ success: true, data: { viewedAt: exists.viewedAt?.toISOString() ?? null } });
    }

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id }, select: { viewedAt: true } });
    return NextResponse.json({ success: true, data: { viewedAt: lead.viewedAt?.toISOString() ?? null } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
