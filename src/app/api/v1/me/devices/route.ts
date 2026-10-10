import { withApiAuth } from "@/server/api/handler";
import { listUserDevices } from "@/server/api/mobile-auth";

export const runtime = "nodejs";

/** Perangkat dan integrasi yang aktif pada akun ini. */
export const GET = withApiAuth(async context => ({ data: await listUserDevices(context.user.id) }));
