import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { issueCredential, listCredentials } from "@/server/api/credentials";

export const runtime = "nodejs";

const createSchema = z.object({
  userId: z.string().trim().min(1).max(191),
  name: z.string().trim().min(2, "Nama kredensial minimal 2 karakter.").max(120),
  expiresInDays: z.number().int().min(1).max(730).nullable().optional(),
});

/** Daftar kredensial API. Nilai kunci tidak pernah dikembalikan. */
export async function GET() {
  try {
    await requireApiRole(["SUPERADMIN"]);
    return NextResponse.json({ success: true, data: await listCredentials() });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/**
 * Menerbitkan kredensial baru untuk satu workspace pengguna.
 * Nilai kunci hanya dikembalikan sekali pada respons ini.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-api-credentials", 20, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);

    const input = createSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Data kredensial tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: { id: input.data.userId, role: "USER", deletedAt: null },
      select: { id: true, status: true },
    });
    if (!target) {
      throw new ThreadsIntegrationError("TARGET_NOT_FOUND", "Workspace pengguna tidak ditemukan. Kredensial hanya dapat diterbitkan untuk akun pengguna bisnis.", 404);
    }
    if (target.status !== "ACTIVE") {
      throw new ThreadsIntegrationError("TARGET_INACTIVE", "Akun pengguna belum aktif, kredensial belum dapat dipakai.", 409);
    }

    const credential = await issueCredential({
      actor,
      userId: target.id,
      name: input.data.name,
      expiresInDays: input.data.expiresInDays ?? null,
    });
    return NextResponse.json({ success: true, data: credential }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
