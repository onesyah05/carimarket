import { NextResponse } from "next/server";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { createPairingCode, listUserDevices } from "@/server/api/mobile-auth";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

/** Perangkat aktif milik pengguna, untuk ditampilkan di Pengaturan. */
export async function GET() {
  try {
    const user = await getSettingsUser();
    return NextResponse.json({ success: true, data: await listUserDevices(user.id) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/**
 * Membuat kode pemasangan aplikasi mobile.
 * Pengguna membuatnya sendiri; tidak perlu bantuan Superadmin.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    enforceRateLimit(`mobile-pairing:${user.id}`, 5, 600_000);
    return NextResponse.json({ success: true, data: await createPairingCode(user) }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
