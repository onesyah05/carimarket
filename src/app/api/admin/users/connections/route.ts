import { ConnectionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

const inputSchema = z.object({ userId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-connections", 30, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);

    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: "Permintaan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: input.data.userId } });
    if (!target) throw new ThreadsIntegrationError("USER_NOT_FOUND", "Pengguna tidak ditemukan.", 404);

    const revoked = await prisma.threadsConnection.updateMany({
      where: { userId: target.id, status: { not: "REVOKED" } },
      data: {
        status: ConnectionStatus.REVOKED,
        tokenCiphertext: null,
        tokenIv: null,
        tokenAuthTag: null,
        tokenKeyVersion: null,
        tokenExpiresAt: null,
      },
    });

    await recordAudit({
      actorId: actor.id,
      action: "THREADS_CONNECTION_RESET",
      entityType: "User",
      entityId: target.id,
      metadata: { revokedCount: revoked.count },
    });

    return NextResponse.json({ success: true, data: { revokedCount: revoked.count } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
