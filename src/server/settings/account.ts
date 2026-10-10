import "server-only";
import type { User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { statusLabel } from "@/lib/format";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

/**
 * Pengaturan akun yang berlaku untuk semua role.
 *
 * Nama, email, dan kata sandi adalah milik akun, bukan milik workspace bisnis,
 * jadi modul ini sengaja tidak membatasi role. Pembatasan role tetap dilakukan
 * di route yang memanggilnya bila memang perlu.
 */

export const identitySchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
  email: z.string().trim().toLowerCase().max(191).pipe(z.email({ message: "Format email tidak valid." })),
  currentPassword: z.string().min(1).max(255).optional(),
});

export type IdentityInput = z.infer<typeof identitySchema>;

export const passwordSchema = z.object({
  currentPassword: z.string().max(255).optional(),
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter.").max(255),
});

export type PasswordInput = z.infer<typeof passwordSchema>;

export type AccountOverview = {
  id: string;
  name: string;
  email: string | null;
  emailIsPlaceholder: boolean;
  emailVerified: boolean;
  role: User["role"];
  roleLabel: string;
  status: User["status"];
  statusLabel: string;
  hasPassword: boolean;
  requiresPasswordForEmailChange: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  permissions: string[];
};

export async function getAccountOverview(user: User): Promise<AccountOverview> {
  const permissions = user.role === "ADMIN"
    ? await prisma.adminPermission.findMany({ where: { userId: user.id }, select: { permission: true } })
    : [];

  return {
    id: user.id,
    name: user.name,
    // Email placeholder berasal dari pendaftaran lewat Threads dan tidak dapat dihubungi.
    email: user.emailIsPlaceholder ? null : user.email,
    emailIsPlaceholder: user.emailIsPlaceholder,
    emailVerified: user.emailVerifiedAt !== null,
    role: user.role,
    roleLabel: statusLabel(user.role),
    status: user.status,
    statusLabel: statusLabel(user.status),
    hasPassword: Boolean(user.passwordHash),
    requiresPasswordForEmailChange: Boolean(user.passwordHash),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    permissions: permissions.map(row => statusLabel(row.permission)),
  };
}

/**
 * Menyimpan nama dan email akun.
 *
 * Mengganti email pada akun yang sudah punya kata sandi wajib disertai kata
 * sandi saat ini. Email baru selalu dianggap belum terverifikasi sampai
 * verifikasi email tersedia.
 */
export async function updateAccountIdentity(user: User, input: IdentityInput) {
  const emailChanged = input.email !== user.email;

  if (emailChanged && user.passwordHash) {
    if (!input.currentPassword) {
      throw new ThreadsIntegrationError("PASSWORD_REQUIRED", "Masukkan kata sandi saat ini untuk mengganti email.", 400);
    }
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new ThreadsIntegrationError("INVALID_CREDENTIALS", "Kata sandi saat ini belum tepat.", 401);
    }
  }

  if (emailChanged) {
    const taken = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (taken && taken.id !== user.id) {
      throw new ThreadsIntegrationError("EMAIL_IN_USE", "Email ini sudah dipakai akun lain.", 409);
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: input.name,
      ...(emailChanged ? { email: input.email, emailIsPlaceholder: false, emailVerifiedAt: null } : {}),
    },
  });

  if (emailChanged) {
    await recordAudit({ actorId: user.id, action: "ACCOUNT_EMAIL_UPDATED", entityType: "User", entityId: user.id });
  }
  if (updated.name !== user.name) {
    await recordAudit({ actorId: user.id, action: "ACCOUNT_NAME_UPDATED", entityType: "User", entityId: user.id });
  }

  return getAccountOverview(updated);
}

/**
 * Mengganti kata sandi dan mengeluarkan sesi lain.
 *
 * Pembaruan memakai syarat hash lama agar dua permintaan bersamaan tidak
 * saling menimpa, lalu sesi baru dibuat untuk perangkat yang sedang dipakai.
 */
export async function changeAccountPassword(user: User, input: PasswordInput, userAgent?: string) {
  if (user.passwordHash) {
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new ThreadsIntegrationError("INVALID_CREDENTIALS", "Kata sandi saat ini belum tepat.", 401);
    }
    if (await verifyPassword(input.newPassword, user.passwordHash)) {
      throw new ThreadsIntegrationError("PASSWORD_REUSED", "Kata sandi baru harus berbeda dari kata sandi saat ini.", 400);
    }
  }

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction(async transaction => {
    const updated = await transaction.user.updateMany({
      where: { id: user.id, passwordHash: user.passwordHash },
      data: { passwordHash },
    });
    if (updated.count !== 1) {
      throw new ThreadsIntegrationError("PASSWORD_CHANGED", "Kata sandi berubah. Muat ulang halaman lalu coba lagi.", 409);
    }
    await transaction.session.deleteMany({ where: { userId: user.id } });
  });

  await createSession(user.id, { userAgent });
  await recordAudit({ actorId: user.id, action: "ACCOUNT_PASSWORD_CHANGED", entityType: "User", entityId: user.id });
  return { hasPassword: true };
}
