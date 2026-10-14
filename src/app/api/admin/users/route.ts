import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { createPlatformUser } from "@/server/admin/users";
import { newUserSchema } from "@/server/admin/new-user";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

const inputSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

/**
 * POST — membuat akun pelanggan baru.
 *
 * Admin boleh menambah akun karena itu bagian dari pekerjaan onboarding
 * mereka. Mengubah status akun (PATCH di bawah) tetap milik Superadmin.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-users-create", 20, 60_000);
    const actor = await requireApiRole(["SUPERADMIN", "ADMIN"]);

    const input = newUserSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const user = await createPlatformUser(input.data, actor.id);
    return NextResponse.json({ success: true, data: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-users", 60, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);

    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: "Permintaan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }
    if (input.data.userId === actor.id) {
      throw new ThreadsIntegrationError("INVALID_TARGET", "Anda tidak dapat mengubah status akun sendiri.", 400);
    }

    const target = await prisma.user.findUnique({ where: { id: input.data.userId } });
    if (!target) throw new ThreadsIntegrationError("USER_NOT_FOUND", "Pengguna tidak ditemukan.", 404);
    if (target.role === "SUPERADMIN") {
      throw new ThreadsIntegrationError("FORBIDDEN", "Status akun Superadmin tidak dapat diubah dari panel ini.", 403);
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { status: input.data.status, suspendedAt: input.data.status === "SUSPENDED" ? new Date() : null },
    });
    if (input.data.status === "SUSPENDED") {
      await prisma.session.deleteMany({ where: { userId: target.id } });
    }

    await recordAudit({
      actorId: actor.id,
      action: input.data.status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED",
      entityType: "User",
      entityId: target.id,
      metadata: { email: target.email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
