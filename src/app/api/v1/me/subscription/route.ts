import { withApiAuth } from "@/server/api/handler";
import { getSubscription } from "@/server/api/me-service";

export const runtime = "nodejs";

/** Paket aktif beserta pemakaian kuota periode berjalan. */
export const GET = withApiAuth(async context => ({ data: await getSubscription(context.user.id) }));
