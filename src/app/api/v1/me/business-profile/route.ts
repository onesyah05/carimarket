import { withApiAuth } from "@/server/api/handler";
import { businessProfileSchema, getBusinessProfile, updateBusinessProfile } from "@/server/settings/workspace-settings";
import { resolveActiveProfile } from "@/server/workspace/profiles";

export const runtime = "nodejs";

/** Profil bisnis yang dipakai menilai relevansi dan menyusun draft. */
export const GET = withApiAuth(async context => {
  const active = await resolveActiveProfile(context.user);
  const { exists, profile } = await getBusinessProfile(active?.id ?? null);
  return { data: { exists, ...profile } };
});

/** Menyimpan profil bisnis. Seluruh kolom wajib diisi. */
export const PUT = withApiAuth(async context => {
  const input = await context.json(businessProfileSchema);
  const active = await resolveActiveProfile(context.user);
  const profile = await updateBusinessProfile({ userId: context.user.id, profileId: active?.id ?? null }, input);
  return { data: { exists: true, ...profile } };
});
