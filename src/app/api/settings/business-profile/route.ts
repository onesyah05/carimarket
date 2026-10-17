import { NextResponse } from "next/server";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { businessProfileSchema, getBusinessProfile, updateBusinessProfile } from "@/server/settings/workspace-settings";
import { getSettingsUser } from "@/server/settings/user";
import { resolveActiveProfile } from "@/server/workspace/profiles";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSettingsUser();
    const active = await resolveActiveProfile(user);
    const { exists, profile } = await getBusinessProfile(active?.id ?? null);
    return NextResponse.json({ success: true, exists, data: profile });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = businessProfileSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message ?? "Profil bisnis tidak valid." }, { status: 400 });
    const user = await getSettingsUser();
    const active = await resolveActiveProfile(user);
    return NextResponse.json({ success: true, exists: true, data: await updateBusinessProfile({ userId: user.id, profileId: active?.id ?? null }, input.data) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
