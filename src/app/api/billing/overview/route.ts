import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { getBillingOverview } from "@/server/billing/transactions";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

/** Paket yang dapat diambil, metode pembayaran, tagihan berjalan, dan histori. */
export async function GET() {
  try {
    const user = await getSettingsUser();
    enforceRateLimit(`billing-overview:${user.id}`, 60, 60_000);
    return NextResponse.json({ success: true, data: await getBillingOverview(user.id) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
