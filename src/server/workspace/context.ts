import "server-only";
import type { BusinessProfile, User } from "@prisma/client";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { requireEntitledUser } from "@/server/auth/access-gate";
import { resolveActiveProfile } from "./profiles";

/**
 * Akun beserta jasa yang sedang dibuka.
 *
 * Hampir setiap endpoint ruang kerja butuh keduanya: akun untuk kepemilikan
 * dan kuota, jasa untuk menentukan kata kunci dan lead mana yang dimaksud.
 * Mengambilnya lewat satu pintu mencegah ada endpoint yang lupa menyaring
 * per jasa lalu menampilkan data jasa lain milik akun yang sama.
 */
export type WorkspaceContext = { user: User; profile: BusinessProfile };

export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const user = await requireEntitledUser();
  const profile = await resolveActiveProfile(user);
  if (!profile) {
    throw new ThreadsIntegrationError(
      "PROFILE_REQUIRED",
      "Lengkapi profil bisnis Anda terlebih dahulu.",
      409,
    );
  }
  return { user, profile };
}

/** Varian yang membolehkan akun belum punya jasa, mis. saat onboarding. */
export async function workspaceContext(): Promise<{ user: User; profile: BusinessProfile | null }> {
  const user = await requireEntitledUser();
  return { user, profile: await resolveActiveProfile(user) };
}
