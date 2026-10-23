import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { readPaymentMethodQr } from "@/server/billing/payment-methods";

export const runtime = "nodejs";

/**
 * Gambar QR sebuah metode pembayaran.
 *
 * Dilayani lewat route, bukan sebagai berkas statis, karena isinya hidup di
 * basis data — itulah yang membuatnya selamat dari deploy yang mengganti
 * seluruh direktori aplikasi.
 *
 * Perlu sesi karena semua halaman yang menampilkannya juga perlu sesi; QR-nya
 * sendiri memang untuk dipindai siapa pun, jadi yang dijaga di sini bukan
 * kerahasiaannya melainkan agar daftar metode tidak dapat ditelusuri dari luar.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiRole(["USER", "ADMIN", "SUPERADMIN"]);
    const { id } = await params;
    const qr = await readPaymentMethodQr(id);
    return new NextResponse(new Uint8Array(qr.content), {
      headers: {
        "Content-Type": qr.mimeType,
        "Content-Length": String(qr.size),
        "Content-Disposition": 'inline; filename="qris.png"',
        // URL-nya sudah bercap waktu, jadi isinya tidak pernah berubah untuk
        // satu alamat yang sama dan aman disimpan peramban.
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
