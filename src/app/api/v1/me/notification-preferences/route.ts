import { withApiAuth } from "@/server/api/handler";
import { getNotificationPreferences, notificationPreferenceSchema, updateNotificationPreferences } from "@/server/settings/workspace-settings";

export const runtime = "nodejs";

/** Preferensi salinan email. Notifikasi dalam aplikasi selalu aktif. */
export const GET = withApiAuth(async context => ({ data: await getNotificationPreferences(context.user.id) }));

/** Mengubah preferensi salinan email. */
export const PUT = withApiAuth(async context => {
  const input = await context.json(notificationPreferenceSchema);
  return { data: await updateNotificationPreferences(context.user.id, input) };
});
