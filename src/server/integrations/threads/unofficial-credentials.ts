import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/server/security/token-encryption";
import { ThreadsIntegrationError } from "./errors";
import { resetUnofficialSessionCache } from "./unofficial-adapter";
import {
  SECRET_THREADS_WEB_COOKIE,
  parseUnofficialCredentials,
  type UnofficialCredentials,
} from "./unofficial-config";

/**
 * Menyimpan & membaca kredensial Threads tidak resmi (cookie sesi web) sebagai
 * rahasia tingkat platform. Hanya Superadmin yang boleh menulis; nilai tidak
 * pernah dikembalikan ke klien dalam bentuk apa pun.
 */

/** Kunci lama dari versi yang masih meminta lsd & csrftoken terpisah. */
const LEGACY_SECRET_KEYS = ["threads_web_lsd", "threads_web_csrf"] as const;

async function putSecret(key: string, value: string, note: string | null) {
  const encrypted = encryptToken(value);
  await prisma.platformSecret.upsert({
    where: { key },
    update: {
      valueCiphertext: encrypted.ciphertext,
      valueIv: encrypted.iv,
      valueAuthTag: encrypted.authTag,
      valueKeyVersion: encrypted.keyVersion,
      note,
      lastCheckedAt: new Date(),
    },
    create: {
      key,
      note,
      valueCiphertext: encrypted.ciphertext,
      valueIv: encrypted.iv,
      valueAuthTag: encrypted.authTag,
      valueKeyVersion: encrypted.keyVersion,
    },
  });
}

async function getSecret(key: string): Promise<string | null> {
  const row = await prisma.platformSecret.findUnique({ where: { key } });
  if (!row) return null;
  try {
    return decryptToken({ ciphertext: row.valueCiphertext, iv: row.valueIv, authTag: row.valueAuthTag });
  } catch {
    return null;
  }
}

export async function saveUnofficialCredentials(input: { cookie: string; note?: string }) {
  const parsed = parseUnofficialCredentials(input.cookie);
  if (!parsed) {
    throw new ThreadsIntegrationError(
      "THREADS_CREDENTIALS_INVALID",
      "Cookie tidak lengkap. Pastikan cookie memuat sessionid, csrftoken, dan ds_user_id.",
      400,
    );
  }

  await putSecret(SECRET_THREADS_WEB_COOKIE, parsed.cookie, input.note ?? null);
  // Sisa dari versi lama: tidak lagi dipakai, dan tidak boleh tertinggal
  // terenkripsi di basis data.
  await prisma.platformSecret.deleteMany({ where: { key: { in: [...LEGACY_SECRET_KEYS] } } });
}

export async function clearUnofficialCredentials() {
  resetUnofficialSessionCache();
  await prisma.platformSecret.deleteMany({
    where: { key: { in: [SECRET_THREADS_WEB_COOKIE, ...LEGACY_SECRET_KEYS] } },
  });
}

/**
 * Status untuk UI admin: apakah kredensial sudah diisi. Tidak mengembalikan nilai.
 */
export async function getUnofficialCredentialsStatus() {
  const cookieRow = await prisma.platformSecret.findUnique({ where: { key: SECRET_THREADS_WEB_COOKIE } });
  return {
    configured: cookieRow !== null,
    note: cookieRow?.note ?? null,
    lastCheckedAt: cookieRow?.lastCheckedAt?.toISOString() ?? null,
    updatedAt: cookieRow?.updatedAt?.toISOString() ?? null,
  };
}

/**
 * Membaca kredensial terenkripsi untuk dipakai adapter.
 * Mengembalikan null bila belum diisi atau tidak dapat didekripsi.
 */
export async function loadUnofficialCredentials(): Promise<UnofficialCredentials | null> {
  return parseUnofficialCredentials((await getSecret(SECRET_THREADS_WEB_COOKIE)) ?? "");
}

/**
 * Versi publik (aman untuk klien) dari status koneksi Threads.
 */
export async function getUnofficialConnectionStatus(): Promise<{ mode: "unofficial" | "none"; configured: boolean }> {
  const status = await getUnofficialCredentialsStatus();
  return { mode: status.configured ? "unofficial" : "none", configured: status.configured };
}
