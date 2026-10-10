import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { cancelTransaction, confirmPayment, confirmPaymentSchema, getBillingOverview } from "@/server/billing/transactions";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }).extend(confirmPaymentSchema.shape),
  z.object({ action: z.literal("cancel") }),
]);

/** Pelanggan menandai sudah membayar, atau membatalkan tagihannya sendiri. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    enforceRateLimit(`billing-action:${user.id}`, 20, 60_000);
    const { id } = await params;
    const input = actionSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }

    if (input.data.action === "confirm") {
      await confirmPayment(user, id, { payerName: input.data.payerName, payerNote: input.data.payerNote });
    } else {
      await cancelTransaction(user, id);
    }
    return NextResponse.json({ success: true, data: await getBillingOverview(user.id) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
