import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

const passwordSchema = z.object({
  currentPassword: z.string().max(255).optional(),
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter.").max(255),
});

export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    enforceRateLimit(`settings-password:${user.id}`, 5, 300_000);
    const input = passwordSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message ?? "Kata sandi tidak valid." }, { status: 400 });
    if (user.passwordHash) {
      if (!input.data.currentPassword || !(await verifyPassword(input.data.currentPassword, user.passwordHash))) {
        throw new ThreadsIntegrationError("INVALID_CREDENTIALS", "Kata sandi saat ini belum tepat.", 401);
      }
      if (await verifyPassword(input.data.newPassword, user.passwordHash)) {
        return NextResponse.json({ error: "Kata sandi baru harus berbeda dari kata sandi saat ini." }, { status: 400 });
      }
    }
    const passwordHash = await hashPassword(input.data.newPassword);
    await prisma.$transaction(async transaction => {
      const updated = await transaction.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash },
        data: { passwordHash },
      });
      if (updated.count !== 1) {
        throw new ThreadsIntegrationError("PASSWORD_CHANGED", "Kata sandi berubah. Muat ulang halaman lalu coba lagi.", 409);
      }
      await transaction.session.deleteMany({ where: { userId: user.id } });
    });
    await createSession(user.id, { userAgent: request.headers.get("user-agent") ?? undefined });
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
