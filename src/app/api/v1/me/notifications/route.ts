import { z } from "zod";
import { withApiAuth } from "@/server/api/handler";
import { countUnreadNotifications, listNotifications, markNotificationsRead } from "@/server/notifications/service";
import { MAX_PER_PAGE } from "@/server/api/response";

export const runtime = "nodejs";

const markSchema = z.object({ ids: z.array(z.string().min(1).max(191)).max(50).optional() });

/** Notifikasi dalam aplikasi beserta jumlah yang belum dibaca. */
export const GET = withApiAuth(async context => {
  const take = Math.min(MAX_PER_PAGE, Math.max(1, Math.trunc(Number(context.searchParams.get("limit")) || 20)));
  const [items, unread] = await Promise.all([
    listNotifications(context.user.id, take),
    countUnreadNotifications(context.user.id),
  ]);
  return { data: { items, unread } };
});

/** Menandai notifikasi terbaca. Tanpa `ids`, seluruh notifikasi ditandai. */
export const PATCH = withApiAuth(async context => {
  const input = await context.json(markSchema);
  const marked = await markNotificationsRead(context.user.id, input.ids);
  return { data: { marked, unread: await countUnreadNotifications(context.user.id) } };
});
