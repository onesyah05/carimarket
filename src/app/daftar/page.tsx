import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";
import { homePathForRole } from "@/lib/redirects";
import { getSessionUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Daftar",
  description: "Buat akun Cari Market dan mulai menemukan percakapan yang relevan dengan bisnis Anda.",
};

export default async function RegisterPage() {
  // Pemilik sesi yang sah tidak perlu melihat formulir pendaftaran; penjaga
  // akses yang menentukan langkah mana yang masih kurang.
  const user = await getSessionUser();
  if (user && user.status !== "SUSPENDED") redirect(homePathForRole(user.role));

  return <AuthShell
    title="Mulai temukan pelanggan."
    copy="Cari Market memantau percakapan Threads dan menyiapkan draft balasan yang sesuai dengan bisnis Anda."
  >
    <RegisterForm />
  </AuthShell>;
}
