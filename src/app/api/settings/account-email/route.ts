import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { verifyPassword } from "@/server/auth/password";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().max(191).pipe(z.email({ message: "Format email tidak valid." })),
  currentPassword: z.string().min(1).max(255).optional(),
});

export async function GET() {
  try {
    const user = await getSettingsUser();
    return NextResponse.json({
      success: true,
      data: {
        email: user.emailIsPlaceholder ? null : user.email,
        isPlaceholder: user.emailIsPlaceholder,
        verified: user.emailVerifiedAt !== null,
        requiresPassword: Boolean(user.passwordHash),
      },
    });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/**
 * Mengganti alamat email akun. Dipakai terutama oleh akun yang dibuat melalui
 * Threads dan masih memakai email placeholder, agar akun punya alamat nyata.
 * Email baru selalu dianggap belum terverifikasi sampai verifikasi email
 * tersedia.
 */
export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    enforceRateLimit(`settings-email:${user.id}`, 5, 600_000);

    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Email tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }

    if (user.passwordHash) {
      if (!input.data.currentPassword) {
        throw new ThreadsIntegrationError("PASSWORD_REQUIRED", "Masukkan kata sandi saat ini untuk mengganti email.", 400);
      }
      if (!(await verifyPassword(input.data.currentPassword, user.passwordHash))) {
        throw new ThreadsIntegrationError("INVALID_CREDENTIALS", "Kata sandi saat ini belum tepat.", 401);
      }
    }

    if (input.data.email === user.email) {
      return NextResponse.json({ success: true, data: { email: user.email, isPlaceholder: user.emailIsPlaceholder, verified: user.emailVerifiedAt !== null, requiresPassword: Boolean(user.passwordHash) } });
    }

    const taken = await prisma.user.findUnique({ where: { email: input.data.email }, select: { id: true } });
    if (taken) throw new ThreadsIntegrationError("EMAIL_IN_USE", "Email ini sudah dipakai akun lain.", 409);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { email: input.data.email, emailIsPlaceholder: false, emailVerifiedAt: null },
      select: { email: true, emailIsPlaceholder: true, emailVerifiedAt: true, passwordHash: true },
    });
    await recordAudit({ actorId: user.id, action: "ACCOUNT_EMAIL_UPDATED", entityType: "User", entityId: user.id });

    return NextResponse.json({
      success: true,
      data: { email: updated.email, isPlaceholder: updated.emailIsPlaceholder, verified: updated.emailVerifiedAt !== null, requiresPassword: Boolean(updated.passwordHash) },
    });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
