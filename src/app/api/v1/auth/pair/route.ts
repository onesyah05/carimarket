import { z } from "zod";
import { withPublicApi } from "@/server/api/handler";
import { redeemPairingCode } from "@/server/api/mobile-auth";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().trim().min(8, "Kode pemasangan terdiri dari 8 karakter.").max(16),
  deviceName: z.string().trim().min(2).max(120).optional(),
});

/**
 * Menukar kode pemasangan menjadi token perangkat.
 *
 * Dipakai akun yang masuk lewat Threads sehingga belum punya kata sandi.
 * Pengguna membuat kodenya sendiri di dashboard web; kode berlaku 10 menit dan
 * hanya dapat ditukar satu kali.
 */
export const POST = withPublicApi(async context => {
  const input = await context.json(schema);
  return { data: await redeemPairingCode(input), status: 201 };
});
