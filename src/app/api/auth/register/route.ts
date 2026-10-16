import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { createSession } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { sendVerificationEmail } from "@/server/auth/email-verification";
import { registerSchema } from "@/server/auth/registration";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}

/**
 * POST — pendaftaran mandiri.
 *
 * Akun dibuat berstatus `PENDING_VERIFICATION` dan langsung diberi sesi.
 * Sesi itu tidak membuka apa pun: penjaga akses hanya mengizinkan halaman
 * "cek email", dan di situlah tombol kirim ulang berada. Tanpa sesi,
 * pengguna yang emailnya tidak sampai tidak punya jalan untuk meminta ulang.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const ip = clientIp(request);
    enforceRateLimit(`auth-register:${ip ?? "unknown"}`, 5, 600_000);

    const input = registerSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: input.data.email }, select: { id: true } });
    if (existing) {
      throw new ThreadsIntegrationError(
        "EMAIL_TAKEN",
        "Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.",
        409,
      );
    }

    const user = await prisma.user.create({
      data: {
        name: input.data.name,
        email: input.data.email,
        passwordHash: await hashPassword(input.data.password),
        role: "USER",
        status: "PENDING_VERIFICATION",
      },
      select: { id: true, name: true, email: true },
    });

    await recordAudit({
      actorId: user.id,
      action: "AUTH_REGISTERED",
      entityType: "User",
      entityId: user.id,
      metadata: { source: "self_service" },
    });

    const delivered = await sendVerificationEmail(user);
    await createSession(user.id, { ip, userAgent: request.headers.get("user-agent") ?? undefined });

    return NextResponse.json({ success: true, data: { email: user.email, delivered } }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
