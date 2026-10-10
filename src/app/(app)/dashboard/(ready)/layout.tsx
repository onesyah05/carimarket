import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/server/auth/page-guards";
import { hasCompleteBusinessProfile } from "@/server/settings/business-profile";

export default async function ReadyDashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole(["USER"], "/dashboard");
  const profile = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
  // Profil belum lengkap berarti onboarding belum selesai: arahkan ke langkah
  // pertama wizard, bukan langsung ke halaman pengaturan.
  if (!hasCompleteBusinessProfile(profile)) redirect("/onboarding/bisnis");
  return children;
}
