import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Verifikasi gagal", robots: { index: false, follow: false } };

const REASONS: Record<string, { title: string; copy: string }> = {
  invalid: {
    title: "Tautan tidak dikenali",
    copy: "Tautan ini tidak cocok dengan permintaan verifikasi mana pun. Mungkin tersalin sebagian, atau sudah digantikan oleh email verifikasi yang lebih baru.",
  },
  expired: {
    title: "Tautan sudah kedaluwarsa",
    copy: "Demi keamanan, tautan verifikasi hanya berlaku 24 jam. Masuk ke akun Anda untuk meminta tautan baru.",
  },
  used: {
    title: "Tautan sudah dipakai",
    copy: "Email Anda kemungkinan sudah terverifikasi. Silakan masuk untuk melanjutkan.",
  },
};

export default async function VerificationFailedPage({ searchParams }: { searchParams: Promise<{ alasan?: string }> }) {
  const { alasan } = await searchParams;
  const reason = REASONS[alasan ?? ""] ?? REASONS.invalid;

  return <AuthShell title="Verifikasi email." copy="Satu langkah kecil sebelum ruang kerja Anda terbuka.">
    <div className="auth-card">
      <h2>{reason.title}</h2>
      <p className="auth-note">{reason.copy}</p>
      <Link className="button button--primary" href="/masuk">Masuk ke akun</Link>
      <p className="auth-switch">Belum punya akun? <Link className="text-link" href="/daftar">Daftar di sini</Link></p>
    </div>
  </AuthShell>;
}
