import { z } from "zod";

/**
 * Validasi isian akun baru dari konsol internal.
 *
 * Dipisah dari `users.ts` supaya dapat diuji tanpa menyentuh database: aturan
 * yang menolak email ganda butuh Prisma, aturan bentuk isian tidak.
 */
export const newUserSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120, "Nama maksimal 120 karakter."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(191, "Email terlalu panjang.")
    .pipe(z.email({ message: "Format email tidak valid." })),
  // Sama dengan ambang penggantian kata sandi di halaman pengaturan akun.
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(255, "Kata sandi terlalu panjang."),
});

export type NewUserInput = z.infer<typeof newUserSchema>;
