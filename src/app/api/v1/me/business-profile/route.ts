import { withApiAuth } from "@/server/api/handler";
import { businessProfileSchema, getBusinessProfile, updateBusinessProfile } from "@/server/settings/workspace-settings";

export const runtime = "nodejs";

/** Profil bisnis yang dipakai menilai relevansi dan menyusun draft. */
export const GET = withApiAuth(async context => {
  const { exists, profile } = await getBusinessProfile(context.user.id);
  return { data: { exists, ...profile } };
});

/** Menyimpan profil bisnis. Seluruh kolom wajib diisi. */
export const PUT = withApiAuth(async context => {
  const input = await context.json(businessProfileSchema);
  const profile = await updateBusinessProfile(context.user.id, input);
  return { data: { exists: true, ...profile } };
});
