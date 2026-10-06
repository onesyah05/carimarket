import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Buat akun" };

export default function RegisterPage() {
  return <AuthShell title="Siapkan ruang kerja bisnis Anda." copy="Mulai dengan profil bisnis, kata kunci, dan aturan balasan yang sesuai."><RegisterForm /></AuthShell>;
}
