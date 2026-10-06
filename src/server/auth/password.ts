import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password.normalize("NFKC"), salt, 64);
  return `scrypt:${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltPart, hashPart] = stored.split(":");
  if (scheme !== "scrypt" || !saltPart || !hashPart) return false;
  const salt = Buffer.from(saltPart, "base64");
  const expected = Buffer.from(hashPart, "base64");
  const derived = await scryptAsync(password.normalize("NFKC"), salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
