import { z } from "zod";
import { withPublicApi } from "@/server/api/handler";
import { loginFromMobile } from "@/server/api/mobile-auth";
import { enforceRateLimit } from "@/server/http/request-guards";
import { ApiError } from "@/server/api/handler";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().toLowerCase().max(191).pipe(z.email({ message: "Format email tidak valid." })),
  password: z.string().min(1, "Kata sandi wajib diisi.").max(255),
  deviceName: z.string().trim().min(2).max(120).optional(),
});

/**
 * Masuk dari aplikasi mobile dan memperoleh token perangkat.
 *
 * Tidak memerlukan kredensial yang diterbitkan Superadmin. Token berlaku 90
 * hari, dapat dicabut pengguna sendiri, dan dibatasi 10 perangkat aktif per
 * akun; perangkat terlama otomatis dicabut saat batas terlampaui.
 */
export const POST = withPublicApi(async context => {
  const input = await context.json(schema);
  // Pembatasan tambahan per email agar percobaan sandi massal tidak efektif.
  try {
    enforceRateLimit(`api-v1-login:${input.email}`, 10, 300_000);
  } catch {
    throw new ApiError("RATE_LIMITED", "Terlalu banyak percobaan masuk untuk akun ini. Coba lagi beberapa menit lagi.");
  }
  return { data: await loginFromMobile(input), status: 201 };
});
