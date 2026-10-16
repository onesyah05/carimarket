import { NextResponse } from "next/server";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { getSettingsUser } from "@/server/settings/user";
import { startFreePlan } from "@/server/billing/free-plan";
import { publicThreadsError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

/**
 * POST — mengaktifkan paket gratis untuk akun yang sedang masuk.
 *
 * Tidak melalui tagihan karena tidak ada yang perlu dibayar; penjaga di
 * `startFreePlan` memastikan satu akun tidak bisa menumpuk langganan.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    enforceRateLimit(`billing-free-plan:${user.id}`, 10, 60_000);
    const plan = await startFreePlan(user);
    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
