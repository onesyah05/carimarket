import "server-only";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { hashPassword } from "@/server/auth/password";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import type { NewUserInput } from "./new-user";

/**
 * Pembuatan akun pelanggan dari konsol internal.
 *
 * Sampai sekarang akun hanya lahir lewat OAuth Threads, sehingga tim tidak
 * punya cara mendaftarkan pelanggan yang dibantu onboarding-nya — dan halaman
 * Admin pun menolak mempromosikan orang yang akunnya belum ada. Operator
 * membuatkan akun, lalu menyerahkan kata sandi awal kepada pemiliknya.
 *
 * Yang sengaja tidak dilakukan: menandai email sebagai terverifikasi. Operator
 * mengetik email itu, bukan pemiliknya, jadi kepemilikannya belum terbukti dan
 * daftar pengguna tetap menandainya "Email belum terverifikasi".
 */

export async function createPlatformUser(input: NewUserInput, actorId: string) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, deletedAt: true },
  });
  if (existing) {
    throw new ThreadsIntegrationError(
      "EMAIL_TAKEN",
      existing.deletedAt
        ? "Email ini pernah dipakai akun yang sudah dihapus. Pakai email lain."
        : "Sudah ada akun dengan email tersebut.",
      409,
    );
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "USER",
      status: "ACTIVE",
    },
    select: { id: true, name: true, email: true },
  });

  await recordAudit({
    actorId,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, source: "internal_console" },
  });

  return user;
}
