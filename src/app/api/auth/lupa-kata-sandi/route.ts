import { NextResponse } from "next/server";
import { forgotPasswordSchema, requestPasswordReset } from "@/server/auth/password-reset";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { isEmailConfigured } from "@/server/integrations/email/mailer";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}

/**
 * POST — meminta tautan pengaturan ulang kata sandi.
 *
 * Jawabannya selalu sama, terdaftar atau tidak, supaya endpoint ini tidak
 * dapat dipakai memeriksa siapa saja yang punya akun. Batasnya dipasang per IP
 * dan per alamat email: tanpa yang kedua, satu alamat dapat dibanjiri email
 * pengaturan ulang dari banyak IP.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const ip = clientIp(request);
    enforceRateLimit(`auth-forgot-ip:${ip ?? "unknown"}`, 10, 900_000);

    if (!isEmailConfigured()) {
      throw new ThreadsIntegrationError(
        "EMAIL_NOT_CONFIGURED",
        "Pengiriman email pemulihan belum aktif di server ini. Silakan hubungi dukungan untuk dibantu secara manual.",
        503,
      );
    }

    const input = forgotPasswordSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Masukkan email yang valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    enforceRateLimit(`auth-forgot-email:${input.data.email}`, 3, 900_000);
    await requestPasswordReset({ email: input.data.email, ip });

    return NextResponse.json({ success: true, data: { email: input.data.email } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
