import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/server/auth/page-guards";
import { hasCompleteBusinessProfile } from "@/server/settings/business-profile";

/**
 * Langkah onboarding setelah profil bisnis mensyaratkan profil yang sudah
 * lengkap. Bila belum, pengguna dikembalikan ke langkah pertama.
 */
export async function requireOnboardingProfile(nextPath: string) {
  const user = await requirePageRole(["USER"], nextPath);
  const profile = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
  if (!hasCompleteBusinessProfile(profile)) redirect("/onboarding/bisnis");
  return { user, profile };
}
