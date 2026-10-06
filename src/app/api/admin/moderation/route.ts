import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

const inputSchema = z.object({
  flagId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
});

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-moderation", 60, 60_000);
    const actor = await requireApiRole(["ADMIN", "SUPERADMIN"]);

    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: "Permintaan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }

    const flag = await prisma.moderationFlag.findUnique({ where: { id: input.data.flagId }, include: { replyDraft: true } });
    if (!flag) throw new ThreadsIntegrationError("FLAG_NOT_FOUND", "Penandaan moderasi tidak ditemukan.", 404);
    if (flag.resolvedAt) throw new ThreadsIntegrationError("FLAG_RESOLVED", "Penandaan ini sudah ditangani.", 409);

    const nextStatus = input.data.decision === "APPROVE" ? "PENDING_APPROVAL" : "CANCELLED";
    await prisma.$transaction([
      prisma.replyDraft.update({
        where: { id: flag.replyDraftId },
        data: {
          status: nextStatus,
          approvedAt: input.data.decision === "APPROVE" ? new Date() : null,
          reviewedById: actor.id,
        },
      }),
      prisma.moderationFlag.update({ where: { id: flag.id }, data: { resolvedAt: new Date() } }),
    ]);

    await recordAudit({
      actorId: actor.id,
      action: input.data.decision === "APPROVE" ? "MODERATION_APPROVED" : "MODERATION_REJECTED",
      entityType: "ReplyDraft",
      entityId: flag.replyDraftId,
      metadata: { ruleCode: flag.ruleCode },
    });

    return NextResponse.json({ success: true, data: { nextStatus } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
