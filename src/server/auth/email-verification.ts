import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMailer } from "@/server/integrations/email/mailer";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { VERIFICATION_TTL_HOURS, buildVerificationEmail, verificationLink } from "./verification-email";

/**
 * Verifikasi email pendaftaran mandiri.
 *
 * Token mengikuti pola Session: nilai acak dikirim lewat email, hanya
 * hash-nya yang tersimpan. Menerbitkan token baru membatalkan token lama
 * milik akun yang sama, jadi tautan dari email sebelumnya langsung mati dan
 * hanya email terakhir yang berlaku.
 */

const TTL_MS = VERIFICATION_TTL_HOURS * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) {
    throw new ThreadsIntegrationError(
      "APP_URL_NOT_CONFIGURED",
      "Pendaftaran belum dapat diproses. Silakan hubungi administrator.",
      503,
    );
  }
  return configured;
}

export async function issueVerificationToken(userId: string) {
  await prisma.emailVerificationToken.deleteMany({ where: { userId, consumedAt: null } });
  const token = randomBytes(32).toString("base64url");
  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return token;
}

/**
 * Mengirim email verifikasi. Tidak pernah melempar: pendaftaran yang sudah
 * tersimpan tidak boleh dibatalkan hanya karena email gagal keluar, dan
 * pemanggil memakai nilai baliknya untuk menawarkan kirim ulang.
 */
export async function sendVerificationEmail(user: Pick<User, "id" | "name" | "email">) {
  const token = await issueVerificationToken(user.id);
  const mail = buildVerificationEmail({ name: user.name, link: verificationLink(appUrl(), token) });
  const result = await getMailer().send({ to: user.email, ...mail });
  return result.delivered;
}

export type VerificationOutcome =
  | { ok: true; userId: string }
  | { ok: false; reason: "INVALID" | "EXPIRED" | "USED" };

/**
 * Menukar token menjadi akun terverifikasi.
 *
 * Token ditandai terpakai dan status akun dinaikkan dalam satu transaksi,
 * sehingga tautan yang diklik dua kali tidak pernah menghasilkan dua akun
 * aktif dari satu token.
 */
export async function consumeVerificationToken(token: string): Promise<VerificationOutcome> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, reason: "INVALID" };

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(trimmed) },
    select: { id: true, userId: true, expiresAt: true, consumedAt: true },
  });
  if (!record) return { ok: false, reason: "INVALID" };
  if (record.consumedAt) return { ok: false, reason: "USED" };
  if (record.expiresAt <= new Date()) return { ok: false, reason: "EXPIRED" };

  const now = new Date();
  const claimed = await prisma.emailVerificationToken.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: now },
  });
  // Dua klik bersamaan: hanya satu yang berhasil menandai token.
  if (!claimed.count) return { ok: false, reason: "USED" };

  await prisma.user.update({
    where: { id: record.userId },
    data: { emailVerifiedAt: now, status: "ACTIVE" },
  });

  return { ok: true, userId: record.userId };
}
