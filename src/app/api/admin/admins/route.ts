import { AdminPermissionKey } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

const permissionSchema = z.enum(["SUPPORT_READ", "SUPPORT_REPLY", "MODERATION_REVIEW", "CONTENT_DRAFT"]);
const promoteSchema = z.object({ email: z.string().trim().toLowerCase(), permissions: z.array(permissionSchema).min(1) });
const permissionsSchema = z.object({ userId: z.string().min(1), permissions: z.array(permissionSchema) });
const demoteSchema = z.object({ userId: z.string().min(1) });

async function replacePermissions(userId: string, permissions: AdminPermissionKey[]) {
  await prisma.$transaction([
    prisma.adminPermission.deleteMany({ where: { userId } }),
    prisma.adminPermission.createMany({ data: permissions.map(permission => ({ userId, permission })) }),
  ]);
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-admins", 30, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);

    const input = promoteSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: "Email dan minimal satu permission wajib diisi.", code: "INVALID_INPUT" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { email: input.data.email } });
    if (!target) throw new ThreadsIntegrationError("USER_NOT_FOUND", "Tidak ada akun dengan email tersebut. Minta orang tersebut mendaftar lebih dulu.", 404);
    if (target.role !== "USER") throw new ThreadsIntegrationError("INVALID_TARGET", "Akun ini sudah menjadi bagian tim internal.", 400);
    if (target.status !== "ACTIVE") throw new ThreadsIntegrationError("ACCOUNT_INACTIVE", "Akun pengguna tidak aktif.", 409);

    await prisma.user.update({ where: { id: target.id }, data: { role: "ADMIN" } });
    await replacePermissions(target.id, input.data.permissions);

    await recordAudit({ actorId: actor.id, action: "ADMIN_PROMOTED", entityType: "User", entityId: target.id, metadata: { email: target.email, permissions: input.data.permissions.join(",") } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-admins", 60, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);

    const input = permissionsSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: "Permintaan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: input.data.userId } });
    if (!target || target.role !== "ADMIN") throw new ThreadsIntegrationError("INVALID_TARGET", "Hanya akun Admin yang dapat diubah.", 400);

    await replacePermissions(target.id, input.data.permissions);
    await recordAudit({ actorId: actor.id, action: "ADMIN_PERMISSIONS_UPDATED", entityType: "User", entityId: target.id, metadata: { permissions: input.data.permissions.join(",") || "kosong" } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-admins", 30, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);

    const input = demoteSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: "Permintaan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }
    if (input.data.userId === actor.id) {
      throw new ThreadsIntegrationError("INVALID_TARGET", "Anda tidak dapat menurunkan akun sendiri.", 400);
    }

    const target = await prisma.user.findUnique({ where: { id: input.data.userId } });
    if (!target || target.role !== "ADMIN") throw new ThreadsIntegrationError("INVALID_TARGET", "Hanya akun Admin yang dapat diturunkan.", 400);

    await prisma.$transaction([
      prisma.adminPermission.deleteMany({ where: { userId: target.id } }),
      prisma.user.update({ where: { id: target.id }, data: { role: "USER" } }),
    ]);

    await recordAudit({ actorId: actor.id, action: "ADMIN_DEMOTED", entityType: "User", entityId: target.id, metadata: { email: target.email } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
