import "server-only";
import { ConnectionStatus, SearchCapability } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/server/security/token-encryption";
import { THREADS_SCOPES } from "./config";
import { ThreadsIntegrationError } from "./errors";
import { refreshLongLivedToken } from "./oauth";

type SavedConnection = {
  userId: string;
  externalAccountId: string;
  username: string;
  accessToken: string;
  expiresIn: number;
};

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
      tokenExpiresAt: expiresAt,
      scopes: [...THREADS_SCOPES],
      lastCheckedAt: new Date(),
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
    select: { id: true, username: true, status: true, capability: true, scopes: true, tokenExpiresAt: true, lastCheckedAt: true },
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
    },
  });
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
  const refreshAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  if (!connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() > refreshAt) return token;

  try {
    const refreshed = await refreshLongLivedToken(token);
    const encrypted = encryptToken(refreshed.access_token);
    await prisma.threadsConnection.update({
      where: { id: connection.id },
      data: {
        tokenCiphertext: encrypted.ciphertext,
        tokenIv: encrypted.iv,
        tokenAuthTag: encrypted.authTag,
        tokenKeyVersion: encrypted.keyVersion,
        tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        lastCheckedAt: new Date(),
      },
    });
    return refreshed.access_token;
  } catch (error) {
    await prisma.threadsConnection.update({ where: { id: connection.id }, data: { status: ConnectionStatus.EXPIRED } });
    throw error;
  }
}
