import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { getMailer } from "@/server/integrations/email/mailer";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { revokeDeviceTokens } from "./credential-revocation";
import { hashPassword } from "./password";
import { PASSWORD_RESET_TTL_MINUTES, buildPasswordResetEmail, passwordResetLink } from "./password-reset-email";

/**
 * Pengaturan ulang kata sandi lewat email.
 *
 * Mengikuti pola EmailVerificationToken: nilai acak dikirim lewat email, hanya
 * hash-nya tersimpan, sekali pakai. Dua hal yang berbeda dan disengaja:
 *
 * 1. Umurnya satu jam, bukan sehari, karena tautan ini membuka akun.
 * 2. Jawaban ke pemanggil selalu sama, berhasil atau tidak. Permintaan yang
 *    membedakan "email terdaftar" dari "tidak terdaftar" berubah menjadi alat
 *    pemeriksa keanggotaan bagi siapa pun yang punya daftar alamat email.
 */

const TTL_MS = PASSWORD_RESET_TTL_MINUTES * 60 * 1000;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().max(191).pipe(z.email({ message: "Format email tidak valid." })),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Tautan pengaturan ulang tidak lengkap.").max(255),
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter.").max(255),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) {
    throw new ThreadsIntegrationError(
      "APP_URL_NOT_CONFIGURED",
      "Pengaturan ulang kata sandi belum dapat diproses. Silakan hubungi administrator.",
      503,
    );
  }
  return configured;
}

/**
 * Membuat dan mengirim tautan pengaturan ulang bila akunnya memang memenuhi
 * syarat. Tidak pernah membocorkan apakah emailnya terdaftar.
 *
 * Akun yang lahir dari OAuth Threads punya email placeholder yang tidak dapat
 * dihubungi; mengirim ke sana hanya menghasilkan bounce, jadi jalur itu
 * dilewati tanpa suara. Orangnya tetap punya jalan masuk lewat Threads.
 */
export async function requestPasswordReset(input: { email: string; ip?: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true, status: true, emailIsPlaceholder: true, deletedAt: true },
  });

  const eligible = user
    && !user.deletedAt
    && !user.emailIsPlaceholder
    && user.status !== "SUSPENDED";
  if (!eligible || !user) return;

  // Tautan sebelumnya dibatalkan agar hanya email terakhir yang berlaku.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, consumedAt: null } });
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TTL_MS),
      // Hanya hash alamatnya yang disimpan, sejalan dengan Session dan AuditLog.
      requestIp: input.ip ? hashToken(input.ip) : null,
    },
  });

  const mail = buildPasswordResetEmail({ name: user.name, link: passwordResetLink(appUrl(), token) });
  const result = await getMailer().send({ to: user.email, ...mail });

  await recordAudit({
    actorId: user.id,
    action: "PASSWORD_RESET_REQUESTED",
    entityType: "User",
    entityId: user.id,
    metadata: { delivered: result.delivered, reason: result.reason ?? null },
  });
}

export type ResetTokenState =
  | { ok: true; name: string }
  | { ok: false; reason: "INVALID" | "EXPIRED" | "USED" };

/** Memeriksa token tanpa memakainya, supaya halaman dapat menjelaskan sebelum form tampil. */
export async function inspectResetToken(token: string): Promise<ResetTokenState> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, reason: "INVALID" };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(trimmed) },
    select: { expiresAt: true, consumedAt: true, user: { select: { name: true, deletedAt: true } } },
  });
  if (!record || record.user.deletedAt) return { ok: false, reason: "INVALID" };
  if (record.consumedAt) return { ok: false, reason: "USED" };
  if (record.expiresAt <= new Date()) return { ok: false, reason: "EXPIRED" };
  return { ok: true, name: record.user.name };
}

export type ResetOutcome =
  | { ok: true; userId: string }
  | { ok: false; reason: "INVALID" | "EXPIRED" | "USED" };

/**
 * Menukar token menjadi kata sandi baru.
 *
 * Token ditandai terpakai, kata sandi ditulis, dan seluruh sesi serta token
 * perangkat dicabut dalam satu transaksi. Pencabutan itu bagian dari
 * pemulihan, bukan tambahan: orang yang mengatur ulang kata sandi biasanya
 * sedang berasumsi akunnya diakses orang lain.
 */
export async function consumeResetToken(input: ResetPasswordInput): Promise<ResetOutcome> {
  const trimmed = input.token.trim();
  if (!trimmed) return { ok: false, reason: "INVALID" };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(trimmed) },
    select: { id: true, userId: true, expiresAt: true, consumedAt: true, user: { select: { deletedAt: true, status: true } } },
  });
  if (!record || record.user.deletedAt) return { ok: false, reason: "INVALID" };
  if (record.consumedAt) return { ok: false, reason: "USED" };
  if (record.expiresAt <= new Date()) return { ok: false, reason: "EXPIRED" };

  const passwordHash = await hashPassword(input.newPassword);
  const revokedDevices = await prisma.$transaction(async transaction => {
    const claimed = await transaction.passwordResetToken.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    // Dua kiriman bersamaan: hanya satu yang berhasil menandai token.
    if (!claimed.count) return null;

    await transaction.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        // Tautan ini sampai ke kotak masuk, jadi kepemilikan email terbukti.
        // Akun yang masih menunggu verifikasi karena itu sekalian diaktifkan.
        ...(record.user.status === "PENDING_VERIFICATION"
          ? { status: "ACTIVE", emailVerifiedAt: new Date() }
          : {}),
      },
    });
    await transaction.session.deleteMany({ where: { userId: record.userId } });
    return revokeDeviceTokens(transaction, record.userId);
  });

  if (revokedDevices === null) return { ok: false, reason: "USED" };

  await recordAudit({
    actorId: record.userId,
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "User",
    entityId: record.userId,
    metadata: { revokedDevices },
  });

  return { ok: true, userId: record.userId };
}
