import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

const createSchema = z.object({
  term: z.string().trim().min(2, "Istilah minimal 2 karakter.").max(120),
  reason: z.string().trim().max(255).optional(),
});

const deleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  try {
    await requireApiRole(["SUPERADMIN"]);
    const terms = await prisma.blacklistTerm.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ success: true, data: terms });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-blacklist", 30, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);

    const input = createSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }

    const normalized = input.data.term.toLocaleLowerCase("id-ID");
    const existing = await prisma.blacklistTerm.findUnique({ where: { normalized } });
    if (existing) throw new ThreadsIntegrationError("TERM_EXISTS", "Istilah ini sudah ada di daftar.", 409);

    const created = await prisma.blacklistTerm.create({
      data: { term: input.data.term, normalized, reason: input.data.reason ?? null, createdById: actor.id },
    });

    await recordAudit({ actorId: actor.id, action: "BLACKLIST_TERM_ADDED", entityType: "BlacklistTerm", entityId: created.id, metadata: { normalized } });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-blacklist", 30, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);

    const input = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: "Permintaan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }

    const removed = await prisma.blacklistTerm.deleteMany({ where: { id: input.data.id } });
    if (removed.count === 0) throw new ThreadsIntegrationError("TERM_NOT_FOUND", "Istilah tidak ditemukan.", 404);

    await recordAudit({ actorId: actor.id, action: "BLACKLIST_TERM_REMOVED", entityType: "BlacklistTerm", entityId: input.data.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
