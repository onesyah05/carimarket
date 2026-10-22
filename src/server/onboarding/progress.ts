import "server-only";
import { KeywordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasCompleteBusinessProfile } from "@/server/settings/business-profile";
import { resolveActiveProfile } from "@/server/workspace/profiles";

/**
 * Satu sumber kebenaran untuk "sudah sampai mana onboarding-nya".
 *
 * Sebelumnya tiap tempat memeriksa syaratnya sendiri — layout dashboard hanya
 * melihat profil bisnis, sedangkan callback Threads langsung mengantar ke
 * dashboard begitu profil terisi. Akibatnya pengguna yang menghubungkan
 * Threads melompati langkah kata kunci dan mode balasan, lalu tiba di
 * dashboard tanpa satu pun kata kunci. Semua pemanggil kini bertanya ke sini.
 */

/**
 * Koneksi Threads tidak ada di sini: ia tidak pernah menjadi syarat, dan
 * mencantumkannya membuat `OnboardingStep` mengizinkan nilai yang tidak pernah
 * dikembalikan. Halamannya masih ada dan dapat dibuka dari Pengaturan.
 */
export const ONBOARDING_STEPS = {
  business: "/onboarding/bisnis",
  keywords: "/onboarding/kata-kunci",
  replies: "/onboarding/balasan",
} as const;

export type OnboardingStep = keyof typeof ONBOARDING_STEPS;

/**
 * Langkah berikutnya yang belum selesai, atau `null` bila onboarding tuntas.
 *
 * Koneksi Threads sengaja tidak menjadi syarat: langkah itu boleh dilewati,
 * dan pencarian tetap berjalan lewat sesi platform.
 */
export async function nextOnboardingStep(userId: string): Promise<OnboardingStep | null> {
  // Tiap jasa menyelesaikan onboarding-nya sendiri, jadi yang diperiksa adalah
  // jasa yang sedang dibuka — bukan jasa pertama akun.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, activeProfileId: true } });
  const profile = user ? await resolveActiveProfile(user) : null;
  if (!hasCompleteBusinessProfile(profile)) return "business";

  const keywords = await prisma.keyword.count({ where: { businessProfileId: profile!.id, kind: KeywordKind.INCLUDE } });
  if (keywords === 0) return "keywords";

  if (!profile?.onboardingCompletedAt) return "replies";
  return null;
}

export async function nextOnboardingPath(userId: string): Promise<string | null> {
  const step = await nextOnboardingStep(userId);
  return step ? ONBOARDING_STEPS[step] : null;
}
