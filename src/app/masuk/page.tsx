import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthShell title="Kembali ke daftar lead." copy="Kelola percakapan, mode balasan, dan kata kunci dari satu ruang kerja."><LoginForm nextPath={next} /></AuthShell>;
}
