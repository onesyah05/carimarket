import "server-only";
import { ConnectionStatus, SearchCapability, ThreadsTokenKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/server/security/token-encryption";
import { THREADS_SCOPES } from "./config";
import { ThreadsIntegrationError } from "./errors";
import { exchangeLongLivedToken, refreshLongLivedToken } from "./oauth";

type SavedConnection = {
  userId: string;
  externalAccountId: string;
  username: string;
  accessToken: string;
  expiresIn: number;
  /**
   * SHORT_LIVED dipakai bila penukaran ke token jangka panjang gagal. Koneksi
   * tetap disimpan agar pengguna bisa langsung memakainya, dan ditingkatkan
   * otomatis pada pemakaian berikutnya.
   */
  tokenKind?: ThreadsTokenKind;
  lastErrorCode?: string | null;
};

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MINIMUM_USABLE_MS = 60_000;

export async function saveThreadsConnection(input: SavedConnection) {
  const encrypted = encryptToken(input.accessToken);
  const expiresAt = new Date(Date.now() + input.expiresIn * 1000);

  return prisma.$transaction(async tx => {
    const ownedElsewhere = await tx.threadsConnection.findUnique({ where: { externalAccountId: input.externalAccountId } });
    if (ownedElsewhere && ownedElsewhere.userId !== input.userId) {
      throw new ThreadsIntegrationError("THREADS_ACCOUNT_IN_USE", "Akun Threads ini sudah terhubung ke workspace lain.", 409);
    }

    await tx.threadsConnection.updateMany({
      where: { userId: input.userId, status: ConnectionStatus.CONNECTED },
      data: { status: ConnectionStatus.REVOKED },
    });

    const data = {
      userId: input.userId,
      username: input.username,
      status: ConnectionStatus.CONNECTED,
      capability: SearchCapability.PUBLIC_SEARCH,
      tokenCiphertext: encrypted.ciphertext,
      tokenIv: encrypted.iv,
      tokenAuthTag: encrypted.authTag,
      tokenKeyVersion: encrypted.keyVersion,
      tokenKind: input.tokenKind ?? ThreadsTokenKind.LONG_LIVED,
      tokenExpiresAt: expiresAt,
      scopes: [...THREADS_SCOPES],
      lastCheckedAt: new Date(),
      lastErrorCode: input.lastErrorCode ?? null,
    };

    return ownedElsewhere
      ? tx.threadsConnection.update({ where: { id: ownedElsewhere.id }, data })
      : tx.threadsConnection.create({ data: { ...data, externalAccountId: input.externalAccountId } });
  });
}

export async function getThreadsConnectionStatus(userId: string) {
  const connection = await prisma.threadsConnection.findFirst({
    where: { userId, status: ConnectionStatus.CONNECTED },
    orderBy: { updatedAt: "desc" },
    select: { id: true, username: true, status: true, capability: true, scopes: true, tokenKind: true, tokenExpiresAt: true, lastCheckedAt: true, lastErrorCode: true },
  });
  return connection;
}

export async function disconnectThreads(userId: string) {
  await prisma.threadsConnection.updateMany({
    where: { userId, status: ConnectionStatus.CONNECTED },
    data: {
      status: ConnectionStatus.REVOKED,
      tokenCiphertext: null,
      tokenIv: null,
      tokenAuthTag: null,
      tokenKeyVersion: null,
      tokenExpiresAt: null,
      lastErrorCode: null,
    },
  });
}

async function persistToken(connectionId: string, token: { access_token: string; expires_in: number }) {
  const encrypted = encryptToken(token.access_token);
  await prisma.threadsConnection.update({
    where: { id: connectionId },
    data: {
      tokenCiphertext: encrypted.ciphertext,
      tokenIv: encrypted.iv,
      tokenAuthTag: encrypted.authTag,
      tokenKeyVersion: encrypted.keyVersion,
      tokenKind: ThreadsTokenKind.LONG_LIVED,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      lastCheckedAt: new Date(),
      lastErrorCode: null,
    },
  });
}

function recordFailure(connectionId: string, code: string, status?: ConnectionStatus) {
  return prisma.threadsConnection.update({
    where: { id: connectionId },
    data: { lastErrorCode: code.slice(0, 100), lastCheckedAt: new Date(), ...(status ? { status } : {}) },
  }).catch(() => undefined);
}

export async function getValidThreadsToken(userId: string) {
  const connection = await prisma.threadsConnection.findFirst({
    where: { userId, status: ConnectionStatus.CONNECTED },
    orderBy: { updatedAt: "desc" },
  });
  if (!connection?.tokenCiphertext || !connection.tokenIv || !connection.tokenAuthTag) {
    throw new ThreadsIntegrationError("THREADS_NOT_CONNECTED", "Hubungkan akun Threads terlebih dahulu.", 409);
  }

  const token = decryptToken({ ciphertext: connection.tokenCiphertext, iv: connection.tokenIv, authTag: connection.tokenAuthTag });
  const expiresAt = connection.tokenExpiresAt?.getTime() ?? null;
  const usableUntilNow = expiresAt === null || expiresAt > Date.now() + MINIMUM_USABLE_MS;

  // Token jangka pendek: coba tingkatkan dulu. Bila Meta masih menolak, token
  // yang ada tetap dipakai selama masih berlaku, jadi koneksi tidak hangus.
  if (connection.tokenKind === ThreadsTokenKind.SHORT_LIVED) {
    try {
      const upgraded = await exchangeLongLivedToken(token);
      await persistToken(connection.id, upgraded);
      return upgraded.access_token;
    } catch (error) {
      const code = error instanceof ThreadsIntegrationError ? error.code : "TOKEN_UPGRADE_FAILED";
      await recordFailure(connection.id, code, usableUntilNow ? undefined : ConnectionStatus.EXPIRED);
      if (usableUntilNow) return token;
      throw new ThreadsIntegrationError(
        "THREADS_TOKEN_EXPIRED",
        "Koneksi Threads sudah kedaluwarsa. Hubungkan kembali akun Anda.",
        401,
        error instanceof ThreadsIntegrationError ? error.diagnostics : undefined,
      );
    }
  }

  if (expiresAt === null || expiresAt > Date.now() + REFRESH_WINDOW_MS) return token;

  try {
    const refreshed = await refreshLongLivedToken(token);
    await persistToken(connection.id, refreshed);
    return refreshed.access_token;
  } catch (error) {
    const code = error instanceof ThreadsIntegrationError ? error.code : "TOKEN_REFRESH_FAILED";
    // Token lama masih bisa dipakai sampai benar-benar kedaluwarsa.
    await recordFailure(connection.id, code, usableUntilNow ? undefined : ConnectionStatus.EXPIRED);
    if (usableUntilNow) return token;
    throw error;
  }
}
