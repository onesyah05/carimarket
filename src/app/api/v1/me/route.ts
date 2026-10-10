import { withApiAuth } from "@/server/api/handler";
import { getIdentity } from "@/server/api/me-service";

export const runtime = "nodejs";

/** Data awal aplikasi: identitas, profil bisnis, paket, dan status Threads. */
export const GET = withApiAuth(async context => ({ data: await getIdentity(context.user.id) }));
