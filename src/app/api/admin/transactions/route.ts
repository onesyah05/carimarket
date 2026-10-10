import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { listTransactionsForAdmin } from "@/server/billing/transactions";

export const runtime = "nodejs";

/** Antrean verifikasi pembayaran beserta ringkasan pendapatan bulan ini. */
export async function GET() {
  try {
    await requireApiRole(["SUPERADMIN"]);
    return NextResponse.json({ success: true, data: await listTransactionsForAdmin() });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
