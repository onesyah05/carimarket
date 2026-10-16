import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/server/auth/email-verification";
import { createSession } from "@/server/auth/session";
import { PLAN_PATH } from "@/server/auth/access-rules";

export const runtime = "nodejs";

/**
 * Tujuan tautan di email verifikasi.
 *
 * Dibuat sebagai route handler, bukan halaman, karena verifikasi yang
 * berhasil langsung membuat sesi — dan cookie hanya boleh ditulis dari route
 * handler atau server action. Orang yang baru membuktikan kepemilikan
 * emailnya tidak perlu diminta mengetik kata sandi lagi untuk langkah
 * berikutnya.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await consumeVerificationToken(token);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.url;

  if (!result.ok) {
    return NextResponse.redirect(new URL(`/verifikasi/gagal?alasan=${result.reason.toLowerCase()}`, base));
  }

  await createSession(result.userId);
  return NextResponse.redirect(new URL(PLAN_PATH, base));
}
