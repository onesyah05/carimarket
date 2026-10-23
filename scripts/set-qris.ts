/**
 * Memasang QRIS sungguhan sebagai metode pembayaran utama.
 *
 * Gambarnya disimpan di basis data, jadi skrip ini perlu dijalankan sekali di
 * tiap lingkungan (lokal, dev, produksi) — deploy tidak membawanya ikut.
 * Menjalankannya ulang dengan berkas baru akan mengganti gambar yang lama.
 *
 * Sekalian membereskan saluran yang sudah tidak dipakai: metode transfer bank
 * yang belum pernah dipakai tagihan dihapus, yang sudah punya histori hanya
 * dinonaktifkan supaya tagihan lama tetap terbaca.
 *
 * Jalankan: npx tsx --tsconfig scripts/tsconfig.json scripts/set-qris.ts <berkas-qris.png>
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const LABEL = "QRIS Cari Market";
const ACCOUNT_NAME = "CARIMARKET.ID";
const NMID = "ID1026622753196";

const MIME_BY_SIGNATURE: Array<[number[], string]> = [
  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png"],
  [[0xff, 0xd8, 0xff], "image/jpeg"],
];

/** Jenis dibaca dari isi berkas, sama seperti yang dilakukan aplikasi. */
function detectMime(content: Buffer) {
  for (const [signature, mime] of MIME_BY_SIGNATURE) {
    if (signature.every((byte, index) => content[index] === byte)) return mime;
  }
  if (content.subarray(0, 4).toString("ascii") === "RIFF" && content.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error("Sebutkan berkas gambar QRIS sebagai argumen.");

  const content = readFileSync(source);
  const mimeType = detectMime(content);
  if (!mimeType) throw new Error("Berkas harus berupa PNG, JPG, atau WebP.");

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.paymentMethod.findFirst({ where: { label: LABEL } });
    const data = {
      channel: "QRIS" as const,
      label: LABEL,
      accountName: ACCOUNT_NAME,
      accountNumber: NMID,
      instructions: null,
      isActive: true,
      // Nol supaya QRIS tampil lebih dulu di pilihan pelanggan.
      sortOrder: 0,
    };
    const image = { content, mimeType, size: content.byteLength };

    const method = existing
      ? await prisma.paymentMethod.update({
        where: { id: existing.id },
        data: { ...data, qr: { upsert: { create: image, update: image } } },
      })
      : await prisma.paymentMethod.create({ data: { ...data, qr: { create: image } } });

    console.log(`QRIS terpasang: ${method.label} (${method.id}), ${Math.round(content.byteLength / 1024)} KB ${mimeType}`);

    // Transfer bank dipensiunkan. Yang pernah dipakai tagihan tidak dihapus
    // agar histori pembayarannya tetap dapat dibaca.
    const banks = await prisma.paymentMethod.findMany({
      where: { channel: "BANK_TRANSFER" },
      include: { _count: { select: { transactions: true } } },
    });
    for (const bank of banks) {
      if (bank._count.transactions === 0) {
        await prisma.paymentMethod.delete({ where: { id: bank.id } });
        console.log(`Metode bank dihapus: ${bank.label}`);
      } else if (bank.isActive) {
        await prisma.paymentMethod.update({ where: { id: bank.id }, data: { isActive: false } });
        console.log(`Metode bank dinonaktifkan (punya ${bank._count.transactions} tagihan): ${bank.label}`);
      }
    }

    const active = await prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { label: true, channel: true, sortOrder: true },
    });
    console.log("Metode aktif:", active.map(entry => `${entry.sortOrder}:${entry.channel}:${entry.label}`).join(", ") || "(tidak ada)");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
