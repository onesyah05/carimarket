import { PrismaClient } from "@prisma/client";
import { PLAN_CATALOG } from "./plan-catalog";

/**
 * Menyinkronkan katalog paket ke database.
 *
 * Aman dijalankan di produksi dan berulang kali: hanya menyentuh tabel `Plan`,
 * mencocokkan baris berdasarkan `code`, dan tidak pernah menghapus paket yang
 * sudah dipakai langganan. Paket yang tidak ada di katalog dinonaktifkan
 * (`isActive = false`) agar histori langganan tetap utuh.
 */
export async function syncPlans(prisma: PrismaClient) {
  const results: Array<{ code: string; price: string; action: "dibuat" | "diperbarui" }> = [];

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
    await prisma.plan.upsert({
      where: { code: entry.code },
      update: data,
      create: { code: entry.code, ...data },
    });
    results.push({ code: entry.code, price: entry.monthlyPrice.toLocaleString("id-ID"), action: existing ? "diperbarui" : "dibuat" });
  }

  const retired = await prisma.plan.updateMany({
    where: { code: { notIn: PLAN_CATALOG.map(entry => entry.code) }, isActive: true },
    data: { isActive: false },
  });

  return { results, retiredCount: retired.count };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const { results, retiredCount } = await syncPlans(prisma);
    for (const row of results) console.log(`${row.action}: ${row.code} Rp ${row.price}/bulan`);
    if (retiredCount > 0) console.log(`dinonaktifkan: ${retiredCount} paket di luar katalog`);
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
