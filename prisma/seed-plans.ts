import { PrismaClient } from "@prisma/client";
import { PLAN_CATALOG } from "./plan-catalog";

/**
 * Menyinkronkan katalog paket ke database.
 *
 * Aman dijalankan di produksi dan berulang kali: hanya menyentuh tabel `Plan`,
 * mencocokkan baris berdasarkan `code`, dan tidak pernah menghapus paket yang
 * sudah dipakai langganan.
 *
 * Paket yang sudah ada TIDAK ditimpa, karena harga dan kuota dapat disunting
 * Superadmin dari panel dan suntingan itu tidak boleh hilang saat deploy.
 * Setel `PLAN_SYNC_FORCE=1` bila memang ingin memaksa nilai katalog kembali.
 * Paket di luar katalog dibiarkan apa adanya agar paket buatan panel tetap
 * hidup.
 */
export async function syncPlans(prisma: PrismaClient, options?: { force?: boolean }) {
  const force = options?.force ?? process.env.PLAN_SYNC_FORCE === "1";
  const results: Array<{ code: string; price: string; action: "dibuat" | "diperbarui" | "dilewati" }> = [];

  for (const entry of PLAN_CATALOG) {
    const existing = await prisma.plan.findUnique({ where: { code: entry.code } });
    const data = {
      name: entry.name,
      monthlyPrice: entry.monthlyPrice,
      monthlySearchLimit: entry.monthlySearchLimit,
      monthlyReplyLimit: entry.monthlyReplyLimit,
      keywordLimit: entry.keywordLimit,
      searchIntervalHours: entry.searchIntervalHours,
      isActive: true,
    };

    if (existing && !force) {
      results.push({ code: entry.code, price: Number(existing.monthlyPrice).toLocaleString("id-ID"), action: "dilewati" });
      continue;
    }

    await prisma.plan.upsert({
      where: { code: entry.code },
      update: data,
      create: { code: entry.code, ...data },
    });
    results.push({ code: entry.code, price: entry.monthlyPrice.toLocaleString("id-ID"), action: existing ? "diperbarui" : "dibuat" });
  }

  return { results, force };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const { results, force } = await syncPlans(prisma);
    for (const row of results) console.log(`${row.action}: ${row.code} Rp ${row.price}/bulan`);
    const skipped = results.filter(row => row.action === "dilewati").length;
    if (skipped > 0 && !force) {
      console.log(`${skipped} paket dibiarkan apa adanya agar suntingan dari panel Superadmin tidak tertimpa. Pakai PLAN_SYNC_FORCE=1 untuk memaksa nilai katalog.`);
    }
    console.log("Katalog paket tersinkron.");
  } finally {
    await prisma.$disconnect();
  }
}

// Hanya dijalankan saat dipanggil langsung sebagai skrip.
if (process.argv[1] && process.argv[1].includes("seed-plans")) {
  main().catch(error => {
    console.error("Sinkronisasi paket gagal:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
