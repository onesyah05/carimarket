import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/server/security/token-encryption";
import { ThreadsIntegrationError } from "./errors";
import {
  SECRET_THREADS_WEB_COOKIE,
  SECRET_THREADS_WEB_CSRF,
  SECRET_THREADS_WEB_LSD,
  parseUnofficialCredentials,
  type UnofficialCredentials,
} from "./unofficial-config";

/**
 * Menyimpan & membaca kredensial Threads tidak resmi (cookie sesi web) sebagai
 * rahasia tingkat platform. Hanya Superadmin yang boleh menulis; nilai tidak
 * pernah dikembalikan ke klien dalam bentuk apa pun.
 */

const SECRET_KEYS = [SECRET_THREADS_WEB_COOKIE, SECRET_THREADS_WEB_LSD, SECRET_THREADS_WEB_CSRF] as const;

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

export async function saveUnofficialCredentials(input: {
  cookie: string;
  lsd: string;
  csrf: string;
  note?: string;
}) {
  const parsed = parseUnofficialCredentials(input.cookie, input.lsd, input.csrf);
  if (!parsed) {
    throw new ThreadsIntegrationError(
      "THREADS_CREDENTIALS_INVALID",
      "Kredensial tidak lengkap. Pastikan cookie memuat sessionid, csrftoken, dan ds_user_id, serta token lsd terisi.",
      400,
    );
  }

  await Promise.all([
    putSecret(SECRET_THREADS_WEB_COOKIE, parsed.cookie, input.note ?? null),
    putSecret(SECRET_THREADS_WEB_LSD, parsed.lsd, null),
    putSecret(SECRET_THREADS_WEB_CSRF, parsed.csrf, null),
  ]);
}

export async function clearUnofficialCredentials() {
  await prisma.platformSecret.deleteMany({ where: { key: { in: [...SECRET_KEYS] } } });
}

/**
 * Status untuk UI admin: apakah kredensial sudah diisi. Tidak mengembalikan nilai.
 */
export async function getUnofficialCredentialsStatus() {
  const rows = await prisma.platformSecret.findMany({ where: { key: { in: [...SECRET_KEYS] } } });
  const present = new Set(rows.map(row => row.key));
  const cookieRow = rows.find(row => row.key === SECRET_THREADS_WEB_COOKIE);
  return {
    configured: SECRET_KEYS.every(key => present.has(key)),
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
  const [cookie, lsd, csrf] = await Promise.all([
    getSecret(SECRET_THREADS_WEB_COOKIE),
    getSecret(SECRET_THREADS_WEB_LSD),
    getSecret(SECRET_THREADS_WEB_CSRF),
  ]);
  return parseUnofficialCredentials(cookie ?? "", lsd ?? "", csrf ?? "");
}

/**
 * Versi publik (aman untuk klien) dari status koneksi Threads.
 */
export async function getUnofficialConnectionStatus(): Promise<{ mode: "unofficial" | "none"; configured: boolean }> {
  const status = await getUnofficialCredentialsStatus();
  return { mode: status.configured ? "unofficial" : "none", configured: status.configured };
}
