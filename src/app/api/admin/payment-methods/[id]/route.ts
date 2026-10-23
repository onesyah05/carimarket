import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { deletePaymentMethod, listPaymentMethodsForAdmin, paymentMethodFormFile, paymentMethodFormValues, paymentMethodSchema, updatePaymentMethod } from "@/server/billing/payment-methods";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-payment-methods", 60, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);
    const { id } = await params;
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Data metode pembayaran tidak terbaca.", code: "INVALID_INPUT" }, { status: 400 });
    const input = paymentMethodSchema.safeParse(paymentMethodFormValues(form));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Data metode pembayaran tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }
    await updatePaymentMethod(actor, id, input.data, paymentMethodFormFile(form));
    return NextResponse.json({ success: true, data: await listPaymentMethodsForAdmin() });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** Menghapus metode yang belum pernah dipakai tagihan. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-payment-methods", 30, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);
    const { id } = await params;
    await deletePaymentMethod(actor, id);
    return NextResponse.json({ success: true, data: await listPaymentMethodsForAdmin() });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
