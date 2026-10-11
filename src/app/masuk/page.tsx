import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";
import { resolveNextPath } from "@/lib/redirects";
import { getSessionUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Masuk" };

/**
 * Sesi diperiksa ke basis data di sini, bukan di proxy, karena proxy hanya
 * melihat ada tidaknya cookie. Pemilik sesi yang sah langsung diantar ke
 * ruang kerjanya; cookie basi berakhir di formulir masuk, bukan di pantulan
 * tanpa henti.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; sesi?: string }> }) {
  const { next, sesi } = await searchParams;
  const safeNext = next && !next.startsWith("/masuk") ? next : undefined;
  const user = await getSessionUser();
  if (user && user.status !== "SUSPENDED") redirect(resolveNextPath(safeNext, user.role));
  return <AuthShell title="Kembali ke daftar lead." copy="Kelola percakapan, mode balasan, dan kata kunci dari satu ruang kerja.">
    <LoginForm nextPath={safeNext} expired={sesi === "habis"} />
  </AuthShell>;
}
