import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { countUnreadNotifications, listNotifications, markNotificationsRead } from "@/server/notifications/service";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

const markSchema = z.object({ ids: z.array(z.string().min(1).max(191)).max(50).optional() });

export async function GET() {
  try {
    const user = await getWorkspaceUser();
    const [items, unread] = await Promise.all([listNotifications(user.id), countUnreadNotifications(user.id)]);
    return NextResponse.json({ success: true, data: { items, unread } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** Menandai notifikasi terbaca. Tanpa `ids`, seluruh notifikasi belum terbaca ditandai. */
export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getWorkspaceUser();
    const input = markSchema.safeParse(await request.json().catch(() => ({})));
    const marked = await markNotificationsRead(user.id, input.success ? input.data.ids : undefined);
    return NextResponse.json({ success: true, data: { marked } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
