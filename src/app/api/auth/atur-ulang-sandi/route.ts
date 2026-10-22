import { NextResponse } from "next/server";
import { consumeResetToken, resetPasswordSchema } from "@/server/auth/password-reset";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

const REASON_MESSAGE: Record<"INVALID" | "EXPIRED" | "USED", string> = {
  INVALID: "Tautan pengaturan ulang tidak dikenali. Minta tautan baru dari halaman lupa kata sandi.",
  EXPIRED: "Tautan pengaturan ulang sudah kedaluwarsa. Minta tautan baru dari halaman lupa kata sandi.",
  USED: "Tautan pengaturan ulang sudah terpakai. Minta tautan baru bila Anda masih perlu mengganti kata sandi.",
};

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}

/**
 * POST — menukar token menjadi kata sandi baru.
 *
 * Sesi tidak dibuat di sini: setelah kata sandi diganti, pengguna diminta
 * masuk sekali dengan kata sandi barunya. Itu membuktikan kata sandinya memang
 * tersimpan dan diingat, bukan sekadar terkirim.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit(`auth-reset:${clientIp(request) ?? "unknown"}`, 10, 900_000);

    const input = resetPasswordSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const result = await consumeResetToken(input.data);
    if (!result.ok) {
      return NextResponse.json({ error: REASON_MESSAGE[result.reason], code: `RESET_TOKEN_${result.reason}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { reset: true } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
