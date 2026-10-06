import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().max(191).pipe(z.email({ message: "Format email tidak valid." })),
  password: z.string().min(1, "Kata sandi wajib diisi.").max(255),
});

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const ip = clientIp(request);
    enforceRateLimit(`auth-login:${ip ?? "unknown"}`, 10, 300_000);

    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: "Masukkan email dan kata sandi yang valid.", code: "INVALID_INPUT" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: input.data.email } });
    if (!user || !user.passwordHash) {
      throw new ThreadsIntegrationError("INVALID_CREDENTIALS", "Email atau kata sandi belum tepat.", 401);
    }
    const valid = await verifyPassword(input.data.password, user.passwordHash);
    if (!valid) {
      throw new ThreadsIntegrationError("INVALID_CREDENTIALS", "Email atau kata sandi belum tepat.", 401);
    }
    if (user.status === "SUSPENDED") {
      throw new ThreadsIntegrationError("ACCOUNT_SUSPENDED", "Akun Anda ditangguhkan. Silakan hubungi dukungan.", 403);
    }
    if (user.status !== "ACTIVE" && user.status !== "PENDING_VERIFICATION") {
      throw new ThreadsIntegrationError("ACCOUNT_INACTIVE", "Akun Anda tidak aktif. Silakan hubungi dukungan.", 403);
    }

    await createSession(user.id, { ip, userAgent: request.headers.get("user-agent") ?? undefined });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "AUTH_LOGIN",
        entityType: "User",
        entityId: user.id,
        ipHash: ip ? createHash("sha256").update(ip).digest("hex") : null,
      },
    }).catch(() => undefined);

    return NextResponse.json({ success: true, data: { role: user.role } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
