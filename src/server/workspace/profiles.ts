import "server-only";
import type { BusinessProfile, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { resolveWorkspacePlan } from "@/server/usage/limits";

/**
 * Jasa (profil bisnis) dalam satu akun.
 *
 * Satu email dapat menaungi beberapa jasa, dan paket menentukan berapa
 * banyak. Kata kunci, lead, dan draft balasan terpisah per jasa — tanpa itu
 * jasa kedua hanya nama, bukan ruang kerja. Kuota paket tetap dihitung
 * per akun: menambah jasa membuka ruang kerja baru, bukan jatah baru.
 */

export type WorkspaceProfile = {
  id: string;
  name: string;
  category: string;
  serviceArea: string | null;
  description: string;
  onboardingCompletedAt: string | null;
};

export function serializeProfile(profile: BusinessProfile): WorkspaceProfile {
  return {
    id: profile.id,
    name: profile.name,
    category: profile.category,
    serviceArea: profile.serviceArea,
    description: profile.description,
    onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
  };
}

export function listProfiles(userId: string) {
  return prisma.businessProfile.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

/**
 * Jasa yang sedang dibuka.
 *
 * Pilihan tersimpan di akun supaya bertahan antar perangkat. Bila pilihannya
 * hilang — jasa dihapus, atau akun dipindahkan — jatuh ke jasa tertua alih-alih
 * menampilkan ruang kerja kosong.
 */
export async function resolveActiveProfile(user: Pick<User, "id" | "activeProfileId">) {
  const profiles = await listProfiles(user.id);
  if (profiles.length === 0) return null;
  return profiles.find(profile => profile.id === user.activeProfileId) ?? profiles[0];
}

/** Batas jumlah jasa menurut paket; null berarti tidak ada paket sama sekali. */
export async function profileLimit(userId: string) {
  const plan = await resolveWorkspacePlan(userId);
  return plan ? plan.businessProfileLimit : null;
}

export async function setActiveProfile(userId: string, profileId: string) {
  const owned = await prisma.businessProfile.findFirst({ where: { id: profileId, userId }, select: { id: true } });
  if (!owned) throw new ThreadsIntegrationError("PROFILE_NOT_FOUND", "Jasa tidak ditemukan.", 404);
  await prisma.user.update({ where: { id: userId }, data: { activeProfileId: profileId } });
  return owned.id;
}

export type NewProfileInput = {
  name: string;
  category: string;
  serviceArea: string;
  description: string;
};

/**
 * Menambah jasa baru ke akun yang sudah ada.
 *
 * Jasa baru langsung menjadi yang aktif: orang yang baru saja membuatnya
 * hampir pasti ingin mengisinya, bukan kembali ke jasa lama.
 */
export async function createProfile(user: Pick<User, "id">, input: NewProfileInput) {
  const [existing, limit] = await Promise.all([
    prisma.businessProfile.count({ where: { userId: user.id } }),
    profileLimit(user.id),
  ]);

  if (limit !== null && existing >= limit) {
    throw new ThreadsIntegrationError(
      "PROFILE_LIMIT_REACHED",
      limit === 1
        ? "Paket Anda hanya mencakup satu jasa. Naikkan paket untuk menambah jasa lain dalam akun yang sama."
        : `Paket Anda mencakup ${limit} jasa dan semuanya sudah terpakai. Naikkan paket untuk menambah jasa lain.`,
      409,
    );
  }

  const profile = await prisma.businessProfile.create({
    data: { userId: user.id, ...input },
  });
  await prisma.user.update({ where: { id: user.id }, data: { activeProfileId: profile.id } });
  await recordAudit({
    actorId: user.id,
    action: "BUSINESS_PROFILE_CREATED",
    entityType: "BusinessProfile",
    entityId: profile.id,
    metadata: { category: profile.category },
  });
  return profile;
}

/** Ringkasan untuk pemilih jasa di ruang kerja. */
export async function profileSwitcherData(user: Pick<User, "id" | "activeProfileId">) {
  const [profiles, limit] = await Promise.all([listProfiles(user.id), profileLimit(user.id)]);
  const active = profiles.find(profile => profile.id === user.activeProfileId) ?? profiles[0] ?? null;
  return {
    profiles: profiles.map(serializeProfile),
    activeId: active?.id ?? null,
    limit,
    canAdd: limit === null || profiles.length < limit,
  };
}

/**
 * Id jasa yang sedang dibuka, dari id akun saja.
 *
 * Dipakai jalur yang hanya memegang `userId` — mis. API mobile, yang belum
 * punya pemilih jasa dan selalu mengikuti jasa aktif akun.
 */
export async function activeProfileId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, activeProfileId: true } });
  if (!user) return null;
  return (await resolveActiveProfile(user))?.id ?? null;
}
