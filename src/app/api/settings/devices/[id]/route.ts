import { NextResponse } from "next/server";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { revokeUserDevice } from "@/server/api/mobile-auth";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

/** Mencabut perangkat dari dashboard web. Hanya perangkat milik sendiri. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    const { id } = await params;
    const revoked = await revokeUserDevice(user.id, id);
    if (!revoked) throw new ThreadsIntegrationError("DEVICE_NOT_FOUND", "Perangkat tidak ditemukan atau sudah dicabut.", 404);
    return NextResponse.json({ success: true, data: { id, revoked: true } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
