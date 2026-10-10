/**
 * Membuat akun Superadmin pertama pada instalasi produksi.
 *
 * Database produksi tidak memakai seed pengembangan, jadi akun Superadmin
 * harus dibuat secara sadar lewat skrip ini. Skrip menolak berjalan bila sudah
 * ada Superadmin, kecuali diizinkan eksplisit, agar hak penuh platform tidak
 * pernah bertambah tanpa sengaja.
 *
 * Jalankan:
 *   SUPERADMIN_EMAIL=nama@domain SUPERADMIN_PASSWORD='sandi kuat' npm run db:create-superadmin
 *
 * Bila SUPERADMIN_PASSWORD tidak diisi, skrip membuat sandi acak dan
 * menampilkannya satu kali. Sandi tidak pernah dicatat ke audit log.
 */
import { randomBytes } from "node:crypto";
import { AccountStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { hashPassword } from "@/server/auth/password";

const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const providedPassword = process.env.SUPERADMIN_PASSWORD;
const name = process.env.SUPERADMIN_NAME?.trim() || "Superadmin";
const allowAdditional = process.env.ALLOW_ADDITIONAL_SUPERADMIN === "1";

function generatePassword() {
  // 24 byte base64url: cukup panjang untuk dipakai sementara sebelum diganti.
  return randomBytes(18).toString("base64url");
}

async function main() {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Setel SUPERADMIN_EMAIL ke alamat email yang valid.");
  }
  if (providedPassword !== undefined && providedPassword.length < 12) {
    throw new Error("SUPERADMIN_PASSWORD minimal 12 karakter.");
  }

  const existingSuperadmins = await prisma.user.count({ where: { role: Role.SUPERADMIN, deletedAt: null } });
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingSuperadmins > 0 && !allowAdditional && existingUser?.role !== Role.SUPERADMIN) {
    throw new Error(
      `Sudah ada ${existingSuperadmins} akun Superadmin. Setel ALLOW_ADDITIONAL_SUPERADMIN=1 bila benar-benar ingin menambah.`,
    );
  }

  const password = providedPassword ?? generatePassword();
  const passwordHash = await hashPassword(password);

  const user = existingUser
    ? await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role: Role.SUPERADMIN,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date(),
        emailIsPlaceholder: false,
        // Sandi hanya diganti bila memang disertakan pada pemanggilan ini.
        ...(providedPassword === undefined && existingUser.passwordHash ? {} : { passwordHash }),
      },
    })
    : await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: Role.SUPERADMIN,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

  await recordAudit({
    actorId: user.id,
    action: existingUser ? "SUPERADMIN_PROMOTED" : "SUPERADMIN_BOOTSTRAPPED",
    entityType: "User",
    entityId: user.id,
    metadata: { email, byScript: true },
  });

  const keptExistingPassword = Boolean(existingUser?.passwordHash) && providedPassword === undefined;
  console.log(`${existingUser ? "Akun dipromosikan" : "Akun dibuat"}: ${email} (role SUPERADMIN, status ACTIVE)`);
  if (keptExistingPassword) {
    console.log("Sandi lama dipertahankan karena SUPERADMIN_PASSWORD tidak disertakan.");
  } else if (providedPassword === undefined) {
    console.log(`Sandi sementara: ${password}`);
    console.log("Ganti sandi ini segera setelah masuk melalui Pengaturan, lalu hapus jejaknya dari riwayat terminal.");
  } else {
    console.log("Sandi diambil dari SUPERADMIN_PASSWORD dan tidak ditampilkan.");
  }
  console.log("Masuk melalui /masuk, lalu buka Superadmin -> API Mobile untuk menerbitkan kredensial aplikasi.");
}

main()
  .catch(error => {
    console.error("Gagal:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
