import { requirePageRole } from "@/server/auth/page-guards";

/**
 * Onboarding hanya untuk akun pengguna bisnis. Kelengkapan profil tidak
 * diperiksa di sini karena langkah pertama justru berfungsi mengisinya;
 * langkah 2 sampai 4 yang memeriksanya sendiri.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["USER"], "/onboarding/bisnis");
  return <>{children}</>;
}
