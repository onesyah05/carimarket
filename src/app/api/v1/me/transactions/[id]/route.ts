import { z } from "zod";
import { withApiAuth } from "@/server/api/handler";
import { cancelTransaction, confirmPayment, confirmPaymentSchema } from "@/server/billing/transactions";

export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }).extend(confirmPaymentSchema.shape),
  z.object({ action: z.literal("cancel") }),
]);

/** Menandai tagihan sudah dibayar, atau membatalkannya. */
export const PATCH = withApiAuth(async context => {
  const transactionId = await context.param("id");
  const input = await context.json(actionSchema);
  if (input.action === "confirm") {
    return { data: await confirmPayment(context.user, transactionId, { payerName: input.payerName, payerNote: input.payerNote }) };
  }
  return { data: await cancelTransaction(context.user, transactionId) };
});
