import { withApiAuth } from "@/server/api/handler";
import { getOverview } from "@/server/api/me-service";

export const runtime = "nodejs";

/** Ringkasan beranda: jumlah lead, antrean balasan, notifikasi, dan kuota. */
export const GET = withApiAuth(async context => ({ data: await getOverview(context.user.id) }));
