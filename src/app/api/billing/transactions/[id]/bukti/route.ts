import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getBillingOverview } from "@/server/billing/transactions";
import { deletePaymentProof, readPaymentProof, savePaymentProof } from "@/server/billing/payment-proof";
import { getSettingsUser } from "@/server/settings/user";

export const runtime = "nodejs";

/**
 * Menampilkan bukti pembayaran kepada pemilik tagihan atau Superadmin yang
 * memverifikasi. Berkas tidak pernah dilayani sebagai berkas statis, karena
 * isinya memuat data mutasi rekening pelanggan.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiRole(["USER", "SUPERADMIN"]);
    const { id } = await params;
    const proof = await readPaymentProof(actor, id);
    const inline = proof.mimeType.startsWith("image/");
    return new NextResponse(new Uint8Array(proof.content), {
      headers: {
        "Content-Type": proof.mimeType,
        "Content-Length": String(proof.content.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="bukti-${proof.invoiceNumber}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** Mengunggah atau mengganti bukti pembayaran tagihan milik sendiri. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    enforceRateLimit(`billing-proof:${user.id}`, 10, 60_000);
    const { id } = await params;
    const form = await request.formData().catch(() => null);
    const file = form?.get("proof");
    if (!(file instanceof File)) {
      throw new ThreadsIntegrationError("INVALID_INPUT", "Berkas bukti pembayaran belum dipilih.", 400);
    }
    await savePaymentProof(user, id, file);
    return NextResponse.json({ success: true, data: await getBillingOverview(user.id) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** Menghapus bukti pembayaran yang terlanjur salah unggah. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    enforceRateLimit(`billing-proof:${user.id}`, 10, 60_000);
    const { id } = await params;
    await deletePaymentProof(user, id);
    return NextResponse.json({ success: true, data: await getBillingOverview(user.id) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
