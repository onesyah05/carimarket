import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";

/**
 * Kredensial API untuk aplikasi mobile.
 *
 * Hanya Superadmin yang menerbitkan; pengguna tidak dapat membuat kunci
 * sendiri. Nilai kunci disimpan sebagai hash SHA-256, ditampilkan satu kali
 * saat penerbitan, dan tidak pernah dicatat ke log.
 */

export const API_KEY_PREFIX = "cmk";
const SECRET_BYTES = 32;
const LAST_USED_THROTTLE_MS = 5 * 60_000;

export type IssuedCredential = {
  id: string;
  name: string;
  keyPrefix: string;
  /** Nilai lengkap kunci. Hanya ada di respons penerbitan. */
  key: string;
  expiresAt: string | null;
};

export type CredentialSummary = {
  id: string;
  name: string;
  keyPrefix: string;
  userId: string;
  userEmail: string;
  userName: string;
  issuedBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  status: "aktif" | "dicabut" | "kedaluwarsa";
};

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Membentuk kunci baru: cmk_<prefix 8 hex>_<rahasia 64 hex>.
 *
 * Rahasia memakai heksadesimal, bukan base64url, agar karakter pemisah `_`
 * tidak pernah muncul di dalam nilainya dan format kunci tetap tidak ambigu.
 */
export function generateApiKey() {
  const prefix = randomBytes(4).toString("hex");
  const secret = randomBytes(SECRET_BYTES).toString("hex");
  return { key: `${API_KEY_PREFIX}_${prefix}_${secret}`, keyPrefix: `${API_KEY_PREFIX}_${prefix}` };
}

/** Mengambil kunci dari header Authorization: Bearer, atau null bila tidak ada. */
export function readBearerKey(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const key = match?.[1];
  if (!key || !key.startsWith(`${API_KEY_PREFIX}_`)) return null;
  return key;
}

function credentialStatus(row: { revokedAt: Date | null; expiresAt: Date | null }): CredentialSummary["status"] {
  if (row.revokedAt) return "dicabut";
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return "kedaluwarsa";
  return "aktif";
}

export async function issueCredential(input: {
  actor: User;
  userId: string;
  name: string;
  expiresInDays?: number | null;
}): Promise<IssuedCredential> {
  const { key, keyPrefix } = generateApiKey();
  const expiresAt = input.expiresInDays && input.expiresInDays > 0
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const credential = await prisma.apiCredential.create({
    data: {
      userId: input.userId,
      createdById: input.actor.id,
      name: input.name.trim().slice(0, 120),
      keyPrefix,
      keyHash: hashApiKey(key),
      expiresAt,
    },
  });

  await recordAudit({
    actorId: input.actor.id,
    action: "API_CREDENTIAL_ISSUED",
    entityType: "ApiCredential",
    entityId: credential.id,
    // Hanya prefix yang dicatat; nilai kunci tidak pernah masuk audit maupun log.
    metadata: { keyPrefix, workspaceUserId: input.userId, expiresAt: expiresAt?.toISOString() ?? null },
  });

  return { id: credential.id, name: credential.name, keyPrefix, key, expiresAt: expiresAt?.toISOString() ?? null };
}

export async function revokeCredential(actor: User, credentialId: string) {
  const credential = await prisma.apiCredential.findUnique({ where: { id: credentialId } });
  if (!credential || credential.revokedAt) return false;

  await prisma.apiCredential.update({ where: { id: credentialId }, data: { revokedAt: new Date() } });
  await recordAudit({
    actorId: actor.id,
    action: "API_CREDENTIAL_REVOKED",
    entityType: "ApiCredential",
    entityId: credentialId,
    metadata: { keyPrefix: credential.keyPrefix, workspaceUserId: credential.userId },
  });
  return true;
}

export async function listCredentials(): Promise<CredentialSummary[]> {
  const rows = await prisma.apiCredential.findMany({
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      user: { select: { email: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    userId: row.userId,
    userEmail: row.user.email,
    userName: row.user.name,
    issuedBy: row.createdBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    status: credentialStatus(row),
  }));
}

/** Kandidat workspace yang dapat diberi kredensial: hanya akun pengguna bisnis. */
export async function listCredentialTargets() {
  const users = await prisma.user.findMany({
    where: { role: "USER", deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, email: true, status: true, businessProfile: { select: { name: true } } },
  });
  return users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    businessName: user.businessProfile?.name ?? null,
  }));
}

export type AuthenticatedCredential = {
  credentialId: string;
  user: User;
};

export type CredentialAuthResult =
  | { ok: true; credential: AuthenticatedCredential }
  | { ok: false; code: "UNAUTHENTICATED" | "CREDENTIAL_REVOKED" | "CREDENTIAL_EXPIRED" | "ACCOUNT_INACTIVE" };

/**
 * Memverifikasi kunci API dan mengembalikan pemilik workspace-nya.
 *
 * Pencarian dilakukan lewat hash, jadi nilai kunci tidak perlu disimpan.
 * `lastUsedAt` diperbarui paling sering sekali per lima menit agar tidak
 * menulis ke database pada setiap permintaan.
 */
export async function authenticateApiKey(key: string): Promise<CredentialAuthResult> {
  const credential = await prisma.apiCredential.findUnique({
    where: { keyHash: hashApiKey(key) },
    include: { user: true },
  });
  if (!credential) return { ok: false, code: "UNAUTHENTICATED" };
  if (credential.revokedAt) return { ok: false, code: "CREDENTIAL_REVOKED" };
  if (credential.expiresAt && credential.expiresAt.getTime() <= Date.now()) return { ok: false, code: "CREDENTIAL_EXPIRED" };
  // API mobile hanya melayani menu pengguna; kunci tidak pernah membuka data internal.
  if (credential.user.role !== "USER" || credential.user.status !== "ACTIVE" || credential.user.deletedAt) {
    return { ok: false, code: "ACCOUNT_INACTIVE" };
  }

  const staleUsage = !credential.lastUsedAt || Date.now() - credential.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS;
  if (staleUsage) {
    await prisma.apiCredential.update({ where: { id: credential.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }

  return { ok: true, credential: { credentialId: credential.id, user: credential.user } };
}

export function newRequestId() {
  return randomUUID();
}
