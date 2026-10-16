import { z } from "zod";

/**
 * Validasi pendaftaran mandiri.
 *
 * Murni, jadi aturan bentuk isian dapat diuji tanpa database. Ambang kata
 * sandi sengaja sama dengan penggantian kata sandi di Pengaturan: satu aturan
 * saja yang perlu diingat pengguna.
 */
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120, "Nama maksimal 120 karakter."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(191, "Email terlalu panjang.")
    .pipe(z.email({ message: "Format email tidak valid." })),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(255, "Kata sandi terlalu panjang."),
  acceptTerms: z.literal(true, { message: "Anda perlu menyetujui syarat dan kebijakan privasi." }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
