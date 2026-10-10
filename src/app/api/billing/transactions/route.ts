import { NextResponse } from "next/server";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { createTransaction, createTransactionSchema, getBillingOverview } from "@/server/billing/transactions";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

/**
 * Membuat tagihan upgrade.
 *
 * Mengembalikan seluruh ringkasan billing, bukan hanya tagihannya, agar
 * halaman langsung menampilkan instruksi pembayaran tanpa permintaan kedua.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    enforceRateLimit(`billing-order:${user.id}`, 10, 60_000);
    const input = createTransactionSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Data tagihan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }
    await createTransaction(user, input.data);
    return NextResponse.json({ success: true, data: await getBillingOverview(user.id) }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
