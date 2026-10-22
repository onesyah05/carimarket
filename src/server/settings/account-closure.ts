import "server-only";
import { createHash } from "node:crypto";
import { ConnectionStatus, Prisma, type User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { revokeAllCredentials } from "@/server/auth/credential-revocation";
import { verifyPassword } from "@/server/auth/password";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

/**
 * Penutupan akun mandiri.
 *
 * PRD menuntut alur penghapusan data, dan App Review Meta menanyakannya; sampai
 * sekarang yang ada hanya halaman yang menyuruh pengguna mengirim email. Jalur
 * mandiri membuat janji itu benar-benar dapat dijalankan.
 *
 * Yang dihapus dan yang tidak, sengaja dibedakan:
 *
 * - **Dihapus**: profil bisnis, kata kunci, lead, draft, notifikasi, koneksi
 *   Threads beserta tokennya, sesi, token perangkat, dan preferensi. Ini data
 *   ruang kerja yang tidak bermakna tanpa pemiliknya.
 * - **Dipertahankan dengan identitas diminimalkan**: `User` (ditandai
 *   `deletedAt`, nama dan email dianonimkan), transaksi, langganan, dan
 *   `AuditLog`. Catatan finansial dan audit memang harus bertahan, dan
 *   menghapus baris `User` akan memutus relasi yang menjaganya.
 *
 * Akun internal tidak dapat ditutup dari sini: menghapus Superadmin terakhir
 * lewat halaman pengaturan bukan tindakan yang boleh bisa dilakukan sendirian.
 */

export const closeAccountSchema = z.object({
  /** Wajib bila akun punya kata sandi. */
  currentPassword: z.string().max(255).optional(),
  /** Konfirmasi yang harus diketik ulang, agar penutupan bukan satu klik. */
  confirmation: z.string().trim(),
});

export type CloseAccountInput = z.infer<typeof closeAccountSchema>;

export const CLOSE_CONFIRMATION = "TUTUP AKUN SAYA";

function anonymizedEmail(userId: string) {
  // Hash dari id, bukan dari email: alamat aslinya tidak boleh dapat
  // dipulihkan dari baris yang tersisa, tetapi kolomnya tetap harus unik.
  const digest = createHash("sha256").update(`closed:${userId}`).digest("hex").slice(0, 24);
  return `terhapus-${digest}@anonim.carimarket.invalid`;
}

export async function closeOwnAccount(user: User, input: CloseAccountInput) {
  if (user.role !== "USER") {
    throw new ThreadsIntegrationError(
      "FORBIDDEN",
      "Akun internal tidak dapat ditutup dari halaman ini. Hubungi Superadmin.",
      403,
    );
  }
  if (input.confirmation !== CLOSE_CONFIRMATION) {
    throw new ThreadsIntegrationError(
      "CONFIRMATION_MISMATCH",
      `Ketik tepat "${CLOSE_CONFIRMATION}" untuk melanjutkan.`,
      400,
    );
  }
  if (user.passwordHash) {
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new ThreadsIntegrationError("INVALID_CREDENTIALS", "Kata sandi saat ini belum tepat.", 401);
    }
  }

  const closedAt = new Date();
  await prisma.$transaction(async transaction => {
    // Ciphertext token dikosongkan lebih dulu, lalu barisnya dibuang. Dua
    // langkah karena yang penting bukan hilangnya baris, melainkan hilangnya
    // token — bila langkah kedua gagal, tokennya sudah tidak ada.
    await transaction.threadsConnection.updateMany({
      where: { userId: user.id },
      data: {
        status: ConnectionStatus.REVOKED,
        tokenCiphertext: null,
        tokenIv: null,
        tokenAuthTag: null,
        tokenKeyVersion: null,
        tokenExpiresAt: null,
        // Kolom Json butuh penanda khusus Prisma untuk benar-benar ditulis NULL.
        scopes: Prisma.DbNull,
      },
    });
    await transaction.threadsConnection.deleteMany({ where: { userId: user.id } });

    await revokeAllCredentials(transaction, user.id);

    await transaction.notification.deleteMany({ where: { userId: user.id } });
    await transaction.notificationPreference.deleteMany({ where: { userId: user.id } });
    await transaction.replyAutomationSetting.deleteMany({ where: { userId: user.id } });
    // Draft dan lead dibuang sebelum profil bisnisnya, karena relasinya
    // bergantung ke sana.
    await transaction.replyDraft.deleteMany({ where: { userId: user.id } });
    await transaction.lead.deleteMany({ where: { userId: user.id } });
    await transaction.keyword.deleteMany({ where: { userId: user.id } });
    await transaction.searchRun.deleteMany({ where: { userId: user.id } });
    await transaction.businessProfile.deleteMany({ where: { userId: user.id } });

    await transaction.user.update({
      where: { id: user.id },
      data: {
        deletedAt: closedAt,
        status: "SUSPENDED",
        name: "Akun terhapus",
        email: anonymizedEmail(user.id),
        emailIsPlaceholder: true,
        emailVerifiedAt: null,
        passwordHash: null,
        activeProfileId: null,
      },
    });
  });

  // Audit log dipertahankan, tetapi tidak boleh memuat alamat email yang baru
  // saja dianonimkan.
  await recordAudit({
    actorId: user.id,
    action: "ACCOUNT_CLOSED",
    entityType: "User",
    entityId: user.id,
    metadata: { closedAt: closedAt.toISOString(), source: "self_service" },
  });

  return { closedAt: closedAt.toISOString() };
}
