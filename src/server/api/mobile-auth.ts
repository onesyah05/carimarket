import "server-only";
import { createHash, randomInt } from "node:crypto";
import { ApiCredentialSource, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { verifyPassword } from "@/server/auth/password";
import { generateApiKey, hashApiKey } from "./credentials";
import { ApiError } from "./handler";

/**
 * Autentikasi mandiri untuk aplikasi mobile.
 *
 * Pengguna memperoleh token perangkat tanpa bantuan Superadmin melalui dua
 * jalur, keduanya menghasilkan kredensial bertipe sama sehingga pencabutan,
 * rate limit, dan audit berlaku seragam:
 *
 * 1. Masuk dengan email dan kata sandi dari dalam aplikasi.
 * 2. Kode pemasangan berumur pendek yang dibuat pengguna di dashboard web,
 *    dipakai akun yang masuk lewat Threads sehingga belum punya kata sandi.
 *
 * Kunci yang diterbitkan Superadmin tetap ada untuk integrasi internal.
 */

const TOKEN_TTL_DAYS = 90;
const PAIRING_CODE_TTL_MS = 10 * 60_000;
const MAX_ACTIVE_DEVICES = 10;

export type DeviceToken = {
  token: string;
  tokenPrefix: string;
  expiresAt: string;
  device: { id: string; name: string };
};

function tokenExpiry() {
  return new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function normalizeDeviceName(value: string | undefined) {
  const trimmed = value?.trim();
  return (trimmed && trimmed.length >= 2 ? trimmed : "Aplikasi mobile").slice(0, 120);
}

/**
 * Membatasi jumlah perangkat aktif dengan mencabut yang paling lama tidak
 * dipakai, supaya token tidak menumpuk tanpa batas pada satu akun.
 */
async function enforceDeviceLimit(userId: string) {
  const active = await prisma.apiCredential.findMany({
    where: { userId, revokedAt: null, source: { in: [ApiCredentialSource.USER_LOGIN, ApiCredentialSource.USER_PAIRING] } },
    orderBy: [{ lastUsedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (active.length < MAX_ACTIVE_DEVICES) return;
  const excess = active.slice(0, active.length - MAX_ACTIVE_DEVICES + 1).map(row => row.id);
  await prisma.apiCredential.updateMany({ where: { id: { in: excess } }, data: { revokedAt: new Date() } });
}

async function issueDeviceToken(user: User, source: ApiCredentialSource, deviceName: string | undefined): Promise<DeviceToken> {
  await enforceDeviceLimit(user.id);
  const { key, keyPrefix } = generateApiKey();
  const expiresAt = tokenExpiry();
  const name = normalizeDeviceName(deviceName);

  const credential = await prisma.apiCredential.create({
    data: { userId: user.id, name, source, keyPrefix, keyHash: hashApiKey(key), expiresAt },
  });

  await recordAudit({
    actorId: user.id,
    action: source === ApiCredentialSource.USER_LOGIN ? "MOBILE_LOGIN" : "MOBILE_PAIRED",
    entityType: "ApiCredential",
    entityId: credential.id,
    metadata: { keyPrefix, device: name },
  });

  return { token: key, tokenPrefix: keyPrefix, expiresAt: expiresAt.toISOString(), device: { id: credential.id, name } };
}

/** Masuk dari aplikasi memakai email dan kata sandi akun. */
export async function loginFromMobile(input: { email: string; password: string; deviceName?: string }): Promise<DeviceToken> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Pesan sengaja sama untuk email tidak terdaftar maupun kata sandi salah.
  const invalid = new ApiError("INVALID_CREDENTIALS", "Email atau kata sandi belum tepat.");
  if (!user || user.deletedAt) throw invalid;
  if (!user.passwordHash) {
    throw new ApiError(
      "PASSWORD_NOT_SET",
      "Akun ini dibuat melalui Threads dan belum memiliki kata sandi. Buat kata sandi di dashboard web, atau pakai kode pemasangan aplikasi.",
    );
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) throw invalid;
  if (user.role !== "USER") throw new ApiError("FORBIDDEN", "Aplikasi mobile hanya untuk akun pengguna bisnis.");
  if (user.status !== "ACTIVE") throw new ApiError("ACCOUNT_INACTIVE", "Akun Anda belum aktif. Hubungi dukungan.");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
  return issueDeviceToken(user, ApiCredentialSource.USER_LOGIN, input.deviceName);
}

function hashPairingCode(code: string) {
  return createHash("sha256").update(code.toUpperCase()).digest("hex");
}

/** Kode 8 karakter tanpa huruf yang mudah tertukar saat dibacakan. */
function generatePairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 8; index += 1) code += alphabet[randomInt(alphabet.length)];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export type PairingCode = { code: string; expiresAt: string };

/** Dibuat dari dashboard web oleh pengguna yang sudah masuk. */
export async function createPairingCode(user: User): Promise<PairingCode> {
  // Kode lama milik pengguna ini dibatalkan agar hanya satu kode yang berlaku.
  await prisma.mobilePairingCode.deleteMany({ where: { userId: user.id, usedAt: null } });

  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
  await prisma.mobilePairingCode.create({ data: { userId: user.id, codeHash: hashPairingCode(code), expiresAt } });
  await recordAudit({ actorId: user.id, action: "MOBILE_PAIRING_CODE_CREATED", entityType: "MobilePairingCode" });

  return { code, expiresAt: expiresAt.toISOString() };
}

/** Ditukar aplikasi menjadi token perangkat. Kode hanya berlaku satu kali. */
export async function redeemPairingCode(input: { code: string; deviceName?: string }): Promise<DeviceToken> {
  const normalized = input.code.trim().toUpperCase().replace(/\s+/g, "");
  const candidates = [normalized, normalized.replace(/-/g, ""), normalized.length === 8 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized];

  let record = null;
  for (const candidate of new Set(candidates)) {
    record = await prisma.mobilePairingCode.findUnique({ where: { codeHash: hashPairingCode(candidate) }, include: { user: true } });
    if (record) break;
  }

  const invalid = new ApiError("PAIRING_CODE_INVALID", "Kode pemasangan tidak dikenali. Buat kode baru dari dashboard web.");
  if (!record) throw invalid;
  if (record.usedAt) throw new ApiError("PAIRING_CODE_USED", "Kode pemasangan sudah terpakai. Buat kode baru dari dashboard web.");
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new ApiError("PAIRING_CODE_EXPIRED", "Kode pemasangan sudah kedaluwarsa. Buat kode baru dari dashboard web.");
  }
  if (record.user.role !== "USER" || record.user.status !== "ACTIVE" || record.user.deletedAt) {
    throw new ApiError("ACCOUNT_INACTIVE", "Akun ini tidak dapat memakai aplikasi mobile.");
  }

  // Penandaan dilakukan bersyarat agar dua permintaan bersamaan tidak sama-sama lolos.
  const claimed = await prisma.mobilePairingCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) throw new ApiError("PAIRING_CODE_USED", "Kode pemasangan sudah terpakai. Buat kode baru dari dashboard web.");

  return issueDeviceToken(record.user, ApiCredentialSource.USER_PAIRING, input.deviceName);
}

export type DeviceSummary = {
  id: string;
  name: string;
  source: ApiCredentialSource;
  sourceLabel: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

const SOURCE_LABEL: Record<ApiCredentialSource, string> = {
  SUPERADMIN: "Diterbitkan admin platform",
  USER_LOGIN: "Masuk dari aplikasi",
  USER_PAIRING: "Dipasangkan dengan kode",
};

/** Perangkat aktif milik pengguna, untuk ditampilkan dan dicabut sendiri. */
export async function listUserDevices(userId: string): Promise<DeviceSummary[]> {
  const rows = await prisma.apiCredential.findMany({
    where: { userId, revokedAt: null },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    source: row.source,
    sourceLabel: SOURCE_LABEL[row.source],
    tokenPrefix: row.keyPrefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  }));
}

/** Pengguna hanya dapat mencabut perangkatnya sendiri. */
export async function revokeUserDevice(userId: string, credentialId: string) {
  const result = await prisma.apiCredential.updateMany({
    where: { id: credentialId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) return false;
  await recordAudit({ actorId: userId, action: "MOBILE_DEVICE_REVOKED", entityType: "ApiCredential", entityId: credentialId });
  return true;
}
