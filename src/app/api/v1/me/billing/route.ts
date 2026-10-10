import { withApiAuth } from "@/server/api/handler";
import { getBillingOverview } from "@/server/billing/transactions";

export const runtime = "nodejs";

/**
 * Pusat billing untuk aplikasi: paket yang dapat diambil, metode pembayaran,
 * tagihan yang sedang berjalan, dan riwayat transaksi.
 */
export const GET = withApiAuth(async context => ({ data: await getBillingOverview(context.user.id) }));
