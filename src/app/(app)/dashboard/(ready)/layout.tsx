import { redirect } from "next/navigation";
import { requirePageRole } from "@/server/auth/page-guards";
import { nextOnboardingPath } from "@/server/onboarding/progress";

/**
 * Ruang kerja hanya terbuka setelah seluruh langkah onboarding selesai.
 * Pemeriksaannya satu pintu lewat `nextOnboardingPath`, jadi tidak ada lagi
 * jalur yang menjatuhkan pengguna ke dashboard tanpa kata kunci.
 */
export default async function ReadyDashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole(["USER"], "/dashboard");
  const pending = await nextOnboardingPath(user.id);
  if (pending) redirect(pending);
  return children;
}
