import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { recordAudit } from "@/server/audit";
import { detectProofType, PROOF_MAX_BYTES, PROOF_TYPE_LABELS, proofFileName } from "./proof-file";

/**
 * Bukti pembayaran yang diunggah pelanggan.
 *
 * Berkasnya disimpan di luar direktori publik dan hanya dapat dibaca lewat
 * route terautentikasi, karena mutasi rekening memuat nama dan nomor yang
 * tidak boleh terbuka untuk siapa pun yang menebak URL. Nama berkas dibuat
 * acak dan ekstensinya ditentukan dari isi berkas, bukan dari nama kiriman.
 */

/** Direktori penyimpanan; dapat dipindah lewat env agar tidak ikut terhapus saat deploy. */
export function proofDirectory() {
  return process.env.PAYMENT_PROOF_DIR ?? path.join(process.cwd(), "storage", "payment-proofs");
}

function resolveStoredPath(storedName: string) {
  // Hanya nama berkas yang disimpan di basis data; cegah path traversal bila
  // nilainya pernah diubah dari luar aplikasi.
  const safeName = path.basename(storedName);
  return path.join(proofDirectory(), safeName);
}

export async function savePaymentProof(user: User, transactionId: string, file: File) {
  const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, userId: user.id } });
  if (!transaction) throw new ThreadsIntegrationError("TRANSACTION_NOT_FOUND", "Tagihan tidak ditemukan.", 404);
  if (transaction.status !== "PENDING" && transaction.status !== "REVIEW") {
    throw new ThreadsIntegrationError(
      "TRANSACTION_CLOSED",
      "Tagihan ini sudah selesai diproses, jadi bukti pembayaran tidak dapat diubah lagi.",
      409,
    );
  }
  if (file.size === 0) throw new ThreadsIntegrationError("PROOF_EMPTY", "Berkas bukti pembayaran kosong.", 400);
  if (file.size > PROOF_MAX_BYTES) {
    throw new ThreadsIntegrationError("PROOF_TOO_LARGE", "Ukuran bukti pembayaran maksimal 4 MB.", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectProofType(bytes);
  if (!type) {
    throw new ThreadsIntegrationError("PROOF_TYPE_REJECTED", `Bukti pembayaran harus berupa ${PROOF_TYPE_LABELS}.`, 400);
  }

  const storedName = proofFileName(transaction.id, randomBytes(8).toString("hex"), type);
  await mkdir(proofDirectory(), { recursive: true });
  await writeFile(resolveStoredPath(storedName), bytes, { mode: 0o600 });

  const previous = transaction.proofPath;
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { proofPath: storedName, proofMimeType: type.mime, proofSize: bytes.byteLength, proofUploadedAt: new Date() },
  });
  if (previous) await unlink(resolveStoredPath(previous)).catch(() => undefined);

  await recordAudit({
    actorId: user.id,
    action: "TRANSACTION_PROOF_UPLOADED",
    entityType: "Transaction",
    entityId: transaction.id,
    metadata: { invoiceNumber: transaction.invoiceNumber, mimeType: type.mime, size: bytes.byteLength },
  });
}

export async function deletePaymentProof(user: User, transactionId: string) {
  const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, userId: user.id } });
  if (!transaction) throw new ThreadsIntegrationError("TRANSACTION_NOT_FOUND", "Tagihan tidak ditemukan.", 404);
  if (!transaction.proofPath) return;
  if (transaction.status !== "PENDING" && transaction.status !== "REVIEW") {
    throw new ThreadsIntegrationError(
      "TRANSACTION_CLOSED",
      "Tagihan ini sudah selesai diproses, jadi bukti pembayaran tidak dapat diubah lagi.",
      409,
    );
  }
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { proofPath: null, proofMimeType: null, proofSize: null, proofUploadedAt: null },
  });
  await unlink(resolveStoredPath(transaction.proofPath)).catch(() => undefined);
  await recordAudit({
    actorId: user.id,
    action: "TRANSACTION_PROOF_REMOVED",
    entityType: "Transaction",
    entityId: transaction.id,
    metadata: { invoiceNumber: transaction.invoiceNumber },
  });
}

/**
 * Membaca bukti untuk ditampilkan. Pemilik tagihan dan Superadmin yang
 * memverifikasi sama-sama boleh melihat; peran lain tidak.
 */
export async function readPaymentProof(actor: User, transactionId: string) {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  const allowed = transaction && (transaction.userId === actor.id || actor.role === "SUPERADMIN");
  if (!transaction || !allowed) {
    throw new ThreadsIntegrationError("TRANSACTION_NOT_FOUND", "Tagihan tidak ditemukan.", 404);
  }
  if (!transaction.proofPath || !transaction.proofMimeType) {
    throw new ThreadsIntegrationError("PROOF_NOT_FOUND", "Tagihan ini belum memiliki bukti pembayaran.", 404);
  }
  try {
    const content = await readFile(resolveStoredPath(transaction.proofPath));
    return { content, mimeType: transaction.proofMimeType, invoiceNumber: transaction.invoiceNumber };
  } catch {
    throw new ThreadsIntegrationError("PROOF_NOT_FOUND", "Berkas bukti pembayaran tidak ditemukan lagi di server.", 404);
  }
}
