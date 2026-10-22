import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Atur ulang kata sandi",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Atur ulang akses akun."
      copy="Masukkan email yang terhubung ke workspace Cari Market dan kami kirimkan tautan pengaturan ulang."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
