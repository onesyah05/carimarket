import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailQuestion } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { ResendVerification } from "@/features/auth/components/resend-verification";
import { VERIFICATION_TTL_HOURS } from "@/server/auth/verification-email";
import { PLAN_PATH } from "@/server/auth/access-rules";
import { requirePageUser } from "@/server/auth/page-guards";

export const metadata: Metadata = { title: "Cek email Anda", robots: { index: false, follow: false } };

/**
 * Ruang tunggu verifikasi: satu-satunya halaman yang terbuka untuk akun yang
 * emailnya belum terverifikasi.
 */
export default async function AwaitingVerificationPage({ searchParams }: { searchParams: Promise<{ kirim?: string }> }) {
  const { kirim } = await searchParams;
  const user = await requirePageUser("/verifikasi/menunggu");
  if (user.emailVerifiedAt) redirect(PLAN_PATH);

  return <AuthShell title="Cek kotak masuk Anda." copy="Verifikasi email memastikan tagihan dan notifikasi lead sampai ke alamat yang benar.">
    <div className="auth-card">
      <p className="auth-badge"><MailQuestion size={16} /> Menunggu verifikasi</p>
      <h2>Email verifikasi sudah dikirim</h2>
      <p className="auth-note">
        Kami mengirim tautan verifikasi ke <strong>{user.email}</strong>. Buka tautan itu untuk mengaktifkan akun.
        Tautan berlaku {VERIFICATION_TTL_HOURS} jam dan hanya dapat dipakai sekali.
      </p>
      <p className="auth-note">Tidak ada di kotak masuk? Periksa folder spam atau promosi lebih dulu.</p>
      <ResendVerification email={user.email} initialFailed={kirim === "gagal"} />
      <p className="auth-note">
        Salah alamat email? <Link className="text-link" href="/kontak">Hubungi dukungan</Link> agar kami perbaiki.
      </p>
    </div>
  </AuthShell>;
}
