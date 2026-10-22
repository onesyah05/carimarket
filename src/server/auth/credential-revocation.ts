import "server-only";
import { ApiCredentialSource, type Prisma } from "@prisma/client";

/**
 * Pencabutan kredensial milik satu akun.
 *
 * Dipakai bersama oleh ganti kata sandi, pengaturan ulang kata sandi, dan
 * penghapusan akun supaya ketiganya tidak pernah berbeda pendapat tentang apa
 * yang harus mati bersama sesi web.
 */

/**
 * Token perangkat yang diterbitkan pengguna sendiri. Kunci terbitan Superadmin
 * sengaja dibiarkan: itu integrasi internal yang tidak ada hubungannya dengan
 * kata sandi pemilik workspace, dan mencabutnya diam-diam akan mematikan
 * layanan yang tidak diminta siapa pun.
 */
const SELF_ISSUED_SOURCES = [ApiCredentialSource.USER_LOGIN, ApiCredentialSource.USER_PAIRING];

type Client = Prisma.TransactionClient;

/** Mencabut token aplikasi mobile milik pengguna. Mengembalikan jumlah yang dicabut. */
export async function revokeDeviceTokens(client: Client, userId: string) {
  const now = new Date();
  const [revoked] = await Promise.all([
    client.apiCredential.updateMany({
      where: { userId, revokedAt: null, source: { in: SELF_ISSUED_SOURCES } },
      data: { revokedAt: now },
    }),
    // Kode pemasangan yang belum ditukar juga kehilangan dasarnya: kode itu
    // menerbitkan token baru tanpa kata sandi.
    client.mobilePairingCode.deleteMany({ where: { userId, usedAt: null } }),
  ]);
  return revoked.count;
}

/** Mencabut seluruh kredensial, termasuk kunci terbitan Superadmin. Untuk akun yang ditutup. */
export async function revokeAllCredentials(client: Client, userId: string) {
  const now = new Date();
  const [sessions, credentials] = await Promise.all([
    client.session.deleteMany({ where: { userId } }),
    client.apiCredential.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
    client.mobilePairingCode.deleteMany({ where: { userId } }),
    client.passwordResetToken.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } }),
    client.emailVerificationToken.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } }),
  ]);
  return { sessions: sessions.count, credentials: credentials.count };
}
