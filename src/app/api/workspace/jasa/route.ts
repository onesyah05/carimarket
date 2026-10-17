import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { getSettingsUser } from "@/server/settings/user";
import { businessProfileSchema } from "@/server/settings/workspace-settings";
import { createProfile, profileSwitcherData, setActiveProfile } from "@/server/workspace/profiles";

export const runtime = "nodejs";

const switchSchema = z.object({ profileId: z.string().min(1).max(191) });

/** GET — daftar jasa dalam akun beserta batas paketnya. */
export async function GET() {
  try {
    const user = await getSettingsUser();
    return NextResponse.json({ success: true, data: await profileSwitcherData(user) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** POST — menambah jasa baru. Ditolak bila jatah paket sudah penuh. */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    enforceRateLimit(`workspace-profile:${user.id}`, 10, 60_000);

    const input = businessProfileSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Data jasa tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const profile = await createProfile(user, input.data);
    return NextResponse.json({ success: true, data: { id: profile.id, name: profile.name } }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** PATCH — memindahkan ruang kerja ke jasa lain milik akun yang sama. */
export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    const input = switchSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: "Jasa tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }
    await setActiveProfile(user.id, input.data.profileId);
    return NextResponse.json({ success: true, data: { activeId: input.data.profileId } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
