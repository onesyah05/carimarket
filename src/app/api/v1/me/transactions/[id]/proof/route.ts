import { withApiAuth } from "@/server/api/handler";
import { deletePaymentProof, savePaymentProof } from "@/server/billing/payment-proof";
import { getBillingOverview } from "@/server/billing/transactions";

export const runtime = "nodejs";

/**
 * Mengunggah bukti pembayaran dari aplikasi sebagai multipart/form-data pada
 * field `proof`. Mengunggah ulang menggantikan bukti sebelumnya.
 */
export const POST = withApiAuth(async context => {
  await savePaymentProof(context.user, await context.param("id"), await context.formFile("proof"));
  return { data: await getBillingOverview(context.user.id) };
});

/** Menghapus bukti pembayaran yang salah unggah. */
export const DELETE = withApiAuth(async context => {
  await deletePaymentProof(context.user, await context.param("id"));
  return { data: await getBillingOverview(context.user.id) };
});
