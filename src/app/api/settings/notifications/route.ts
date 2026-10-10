import { NextResponse } from "next/server";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { getNotificationPreferences, notificationPreferenceSchema, updateNotificationPreferences } from "@/server/settings/workspace-settings";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSettingsUser();
    return NextResponse.json({ success: true, data: await getNotificationPreferences(user.id) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = notificationPreferenceSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Pilihan notifikasi tidak valid." }, { status: 400 });
    const user = await getSettingsUser();
    return NextResponse.json({ success: true, data: await updateNotificationPreferences(user.id, input.data) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
