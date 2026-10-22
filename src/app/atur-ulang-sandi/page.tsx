import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { inspectResetToken } from "@/server/auth/password-reset";

export const metadata: Metadata = {
  title: "Buat kata sandi baru",
  robots: { index: false, follow: false },
};

const REASON_COPY: Record<"INVALID" | "EXPIRED" | "USED", string> = {
  INVALID: "Tautan ini tidak dikenali. Mungkin tersalin tidak lengkap, atau sudah digantikan permintaan yang lebih baru.",
  EXPIRED: "Tautan ini sudah lewat 60 menit sejak dikirim, jadi tidak berlaku lagi.",
  USED: "Tautan ini sudah dipakai untuk mengganti kata sandi. Satu tautan hanya berlaku sekali.",
};

/**
 * Token diperiksa di server sebelum form tampil, supaya tautan mati tidak
 * membuat orang mengetik kata sandi baru dua kali lalu baru ditolak.
 */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const state = await inspectResetToken(token).catch(() => ({ ok: false, reason: "INVALID" } as const));

  return (
    <AuthShell
      title="Satu langkah lagi."
      copy="Pilih kata sandi baru untuk akun Cari Market Anda, lalu masuk kembali."
    >
      {state.ok
        ? <ResetPasswordForm token={token} name={state.name} />
        : <div className="auth-card">
          <h2>Tautan tidak dapat dipakai</h2>
          <p className="form-error" role="alert">{REASON_COPY[state.reason]}</p>
          <p className="auth-note">Minta tautan baru, lalu buka tautan terakhir yang masuk ke kotak masuk Anda.</p>
          <Link className="button button--primary" href="/lupa-kata-sandi">Minta tautan baru</Link>
          <Link className="text-link" href="/masuk">Kembali ke halaman masuk</Link>
        </div>}
    </AuthShell>
  );
}
