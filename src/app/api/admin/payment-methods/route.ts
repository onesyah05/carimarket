import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { createPaymentMethod, listPaymentMethodsForAdmin, paymentMethodSchema } from "@/server/billing/payment-methods";

export const runtime = "nodejs";

/** Daftar metode pembayaran beserta jumlah tagihan yang memakainya. */
export async function GET() {
  try {
    await requireApiRole(["SUPERADMIN"]);
    return NextResponse.json({ success: true, data: await listPaymentMethodsForAdmin() });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** Menambah tujuan pembayaran yang langsung tampil kepada pelanggan. */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-payment-methods", 30, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);
    const input = paymentMethodSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Data metode pembayaran tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }
    await createPaymentMethod(actor, input.data);
    return NextResponse.json({ success: true, data: await listPaymentMethodsForAdmin() }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
