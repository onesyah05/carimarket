import { withApiAuth } from "@/server/api/handler";
import { createTransaction, createTransactionSchema } from "@/server/billing/transactions";

export const runtime = "nodejs";

/**
 * Membuat tagihan upgrade dari aplikasi.
 *
 * Satu akun hanya boleh memiliki satu tagihan terbuka, jadi tagihan berjalan
 * dijawab CONFLICT dan aplikasi menampilkan tagihan itu dari endpoint billing.
 */
export const POST = withApiAuth(async context => ({
  data: await createTransaction(context.user, await context.json(createTransactionSchema)),
  status: 201,
}));
