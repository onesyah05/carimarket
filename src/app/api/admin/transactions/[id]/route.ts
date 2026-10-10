import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { listTransactionsForAdmin, reviewTransaction, reviewTransactionSchema } from "@/server/billing/transactions";

export const runtime = "nodejs";

/**
 * Verifikasi pembayaran: menyetujui mengaktifkan paket, menolak memberi tahu
 * pelanggan beserta alasannya.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-transactions", 60, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);
    const { id } = await params;
    const input = reviewTransactionSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Keputusan verifikasi tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }
    await reviewTransaction(actor, id, input.data);
    return NextResponse.json({ success: true, data: await listTransactionsForAdmin() });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
