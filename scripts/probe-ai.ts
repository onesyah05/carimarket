/**
 * Pemeriksaan manual integrasi penilaian AI.
 *
 * Memanggil penyedia yang sebenarnya dengan konfigurasi dari `.env`, lalu
 * mencetak vonis dan — bila gagal — sebab kegagalannya. Gunanya memastikan
 * jalur cadangan benar-benar berjalan dan tidak melempar, karena itulah yang
 * menentukan apakah pencarian tetap menyimpan lead saat penyedia mati.
 *
 * Jalankan: npx tsx --tsconfig scripts/tsconfig.json scripts/probe-ai.ts
 */
import { readFileSync } from "node:fs";

// tsx tidak memuat `.env` seperti Next, dan impor di-hoist sebelum baris mana
// pun di sini, jadi modulnya diambil dinamis setelah env terpasang.
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
}

async function main() {
  const { getAiClient } = await import("../src/server/integrations/ai/opencode-client");
  const { judgeLead } = await import("../src/server/leads/ai-matching");

  const client = getAiClient();
  console.log(`configured=${client.configured} model=${client.model}`);

  // Contoh nyata dari feed: iklan rental mobil yang lolos kata kunci milik
  // studio desain. Inilah kasus yang tidak dapat dibedakan tanpa membaca isi.
  const result = await judgeLead(
    { name: "Langit Visual", category: "Jasa kreatif", serviceArea: "Jabodetabek", description: "Studio desain grafis dan branding." },
    "jasa desain logo",
    "Hallo warga threads, butuh jasa antar jemput bandara, sewa mobil + driver, hubungi 0851.",
    client,
  );
  console.log(`verdict=${result.verdict} failure=${result.failure ?? "-"} score=${result.score} model=${result.model ?? "-"} reason=${result.reason ?? "-"}`);
}

void main();
