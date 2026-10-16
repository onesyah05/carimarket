import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/server/auth/email-verification";
import { getSessionUser } from "@/server/auth/session";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

/**
 * POST — kirim ulang email verifikasi untuk akun yang sedang masuk.
 *
 * Hanya untuk akun yang memang belum terverifikasi, dan dibatasi lajunya:
 * tombol ini mengirim email ke alamat pihak ketiga, jadi tidak boleh bisa
 * dipakai membanjiri siapa pun.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getSessionUser();
    if (!user) {
      throw new ThreadsIntegrationError("UNAUTHENTICATED", "Sesi Anda berakhir. Silakan masuk kembali.", 401);
    }
    enforceRateLimit(`auth-verify-resend:${user.id}`, 3, 600_000);

    if (user.emailVerifiedAt) {
      throw new ThreadsIntegrationError("ALREADY_VERIFIED", "Email akun ini sudah terverifikasi.", 409);
    }
    if (user.emailIsPlaceholder) {
      throw new ThreadsIntegrationError(
        "EMAIL_PLACEHOLDER",
        "Akun ini belum punya alamat email yang dapat dihubungi. Isi email Anda di Pengaturan.",
        409,
      );
    }

    const delivered = await sendVerificationEmail(user);
    if (!delivered) {
      throw new ThreadsIntegrationError(
        "EMAIL_NOT_SENT",
        "Email verifikasi belum dapat dikirim. Coba lagi beberapa saat atau hubungi dukungan.",
        502,
      );
    }

    return NextResponse.json({ success: true, data: { email: user.email } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
