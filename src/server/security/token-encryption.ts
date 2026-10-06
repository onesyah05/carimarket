import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

type EncryptedToken = { ciphertext: string; iv: string; authTag: string; keyVersion: number };

function encryptionKey() {
  const value = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!value) throw new ThreadsIntegrationError("ENCRYPTION_KEY_MISSING", "Keamanan koneksi belum dapat dibaca. Hubungkan ulang akun Threads Anda.", 503);

  const key = /^[a-f\d]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new ThreadsIntegrationError("ENCRYPTION_KEY_INVALID", "Keamanan koneksi belum dapat dibaca. Hubungkan ulang akun Threads Anda.", 503);
  }
  return key;
}

export function encryptToken(token: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: 1,
  };
}

export function decryptToken(input: { ciphertext: string; iv: string; authTag: string }) {
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(input.iv, "base64"));
    decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(input.ciphertext, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new ThreadsIntegrationError("TOKEN_DECRYPTION_FAILED", "Token Threads tidak dapat dibaca. Hubungkan ulang akun.", 401);
  }
}
