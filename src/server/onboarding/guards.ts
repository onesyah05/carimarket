import "server-only";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/server/auth/page-guards";
import { hasCompleteBusinessProfile } from "@/server/settings/business-profile";
import { resolveActiveProfile } from "@/server/workspace/profiles";

/**
 * Langkah onboarding setelah profil bisnis mensyaratkan profil yang sudah
 * lengkap. Bila belum, pengguna dikembalikan ke langkah pertama.
 */
export async function requireOnboardingProfile(nextPath: string) {
  const user = await requirePageRole(["USER"], nextPath);
  const profile = await resolveActiveProfile(user);
  if (!hasCompleteBusinessProfile(profile)) redirect("/onboarding/bisnis");
  return { user, profile };
}
