/**
 * Audit kesesuaian batas pemakaian dengan paket langganan.
 *
 * Hanya membaca database. Memakai `getQuotaSnapshot` yang sama dengan yang
 * dipakai route API dan worker, jadi hasil audit mencerminkan keputusan server
 * yang sebenarnya, bukan perhitungan ulang.
 *
 * Jalankan: npm run db:audit-quota
 */
import { KeywordKind, SearchFrequency, ReplyStatus, SearchRunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getQuotaSnapshot } from "@/server/usage/limits";
import { currentPeriodStart } from "@/server/usage/quota";
import { PLAN_CATALOG } from "../prisma/plan-catalog";

function pad(value: string | number, width: number) {
  return String(value).padEnd(width);
}

function quotaText(check: { used: number; limit: number | null }) {
  return check.limit === null ? `${check.used}/tanpa batas` : `${check.used}/${check.limit}`;
}

async function auditPlans() {
  console.log("== Paket di database ==");
  const plans = await prisma.plan.findMany({ orderBy: { monthlyPrice: "asc" }, include: { _count: { select: { subscriptions: true } } } });
  const problems: string[] = [];

  for (const plan of plans) {
    const catalog = PLAN_CATALOG.find(entry => entry.code === plan.code);
    const drift: string[] = [];
    if (catalog) {
      if (Number(plan.monthlyPrice) !== catalog.monthlyPrice) drift.push(`harga ${Number(plan.monthlyPrice)} != katalog ${catalog.monthlyPrice}`);
      if (plan.monthlySearchLimit !== catalog.monthlySearchLimit) drift.push(`pencarian ${plan.monthlySearchLimit} != ${catalog.monthlySearchLimit}`);
      if (plan.monthlyReplyLimit !== catalog.monthlyReplyLimit) drift.push(`balasan ${plan.monthlyReplyLimit} != ${catalog.monthlyReplyLimit}`);
      if (plan.keywordLimit !== catalog.keywordLimit) drift.push(`kata kunci ${plan.keywordLimit} != ${catalog.keywordLimit}`);
    }
    console.log(
      `${pad(plan.code, 9)} Rp ${pad(Number(plan.monthlyPrice).toLocaleString("id-ID"), 9)} ` +
      `kk=${pad(plan.keywordLimit, 3)} cari=${pad(plan.monthlySearchLimit, 6)} balas=${pad(plan.monthlyReplyLimit, 5)} ` +
      `aktif=${plan.isActive ? "ya " : "tidak"} langganan=${plan._count.subscriptions}` +
      (catalog ? "" : "  [di luar katalog]") + (drift.length ? `  [BEDA: ${drift.join("; ")}]` : ""),
    );
    if (drift.length) problems.push(`${plan.code}: ${drift.join("; ")}`);
  }

  const cheapestActive = plans.filter(plan => plan.isActive)[0];
  console.log(`\nPaket bawaan untuk pengguna tanpa langganan: ${cheapestActive ? `${cheapestActive.code} (termurah aktif)` : "tidak ada paket aktif, pemakaian tanpa batas"}`);
  return problems;
}

async function auditUsers() {
  const periodStart = currentPeriodStart();
  console.log(`\n== Pengguna (periode ${periodStart.toISOString().slice(0, 7)}) ==`);

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, email: true, role: true, status: true,
      subscriptions: { where: { status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } }, select: { status: true, plan: { select: { code: true } } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const problems: string[] = [];

  for (const user of users) {
    const snapshot = await getQuotaSnapshot(user.id);
    const subscription = user.subscriptions[0];
    const [keywordsAll, keywordsInclude, keywordsPaused, hourly, daily, manual] = await Promise.all([
      prisma.keyword.count({ where: { userId: user.id } }),
      prisma.keyword.count({ where: { userId: user.id, kind: KeywordKind.INCLUDE } }),
      prisma.keyword.count({ where: { userId: user.id, isActive: false } }),
      prisma.keyword.count({ where: { userId: user.id, isActive: true, kind: KeywordKind.INCLUDE, frequency: SearchFrequency.HOURLY } }),
      prisma.keyword.count({ where: { userId: user.id, isActive: true, kind: KeywordKind.INCLUDE, frequency: SearchFrequency.DAILY } }),
      prisma.keyword.count({ where: { userId: user.id, isActive: true, kind: KeywordKind.INCLUDE, frequency: SearchFrequency.MANUAL } }),
    ]);

    // Proyeksi pemakaian bila seluruh jadwal berjalan penuh satu bulan.
    const projectedSearches = hourly * 24 * 30 + daily * 30;

    // Sumber kebenaran pemakaian: jejak eksekusi, bukan penghitung agregat.
    const [searchRuns, repliesSent, usageEvents] = await Promise.all([
      prisma.searchRun.count({ where: { userId: user.id, status: SearchRunStatus.COMPLETED, createdAt: { gte: periodStart } } }),
      prisma.replyDeliveryAttempt.count({ where: { replyDraft: { userId: user.id }, status: { in: [ReplyStatus.SENT, ReplyStatus.SIMULATED_SENT] }, attemptedAt: { gte: periodStart } } }),
      prisma.usageEvent.groupBy({ by: ["type"], where: { userId: user.id, occurredAt: { gte: periodStart } }, _sum: { units: true } }),
    ]);
    const eventSearch = usageEvents.find(row => row.type === "SEARCH")?._sum.units ?? 0;
    const eventReply = usageEvents.find(row => row.type === "REPLY")?._sum.units ?? 0;

    const planLabel = snapshot.plan ? `${snapshot.plan.code}(${snapshot.plan.source === "subscription" ? "langganan" : "bawaan"})` : "tanpa paket";
    console.log(
      `\n${user.email}  [${user.role}/${user.status}]\n` +
      `  paket            : ${planLabel}${subscription ? ` | langganan ${subscription.plan.code} status ${subscription.status}` : " | tanpa langganan"}\n` +
      `  kata kunci       : ${quotaText(snapshot.keywords)} (include ${keywordsInclude}, exclude ${keywordsAll - keywordsInclude}, dijeda ${keywordsPaused}) -> ${snapshot.keywords.allowed ? "boleh tambah" : "DITOLAK"}\n` +
      `  pencarian bulan  : ${quotaText(snapshot.search)} -> ${snapshot.search.allowed ? "boleh" : "DITOLAK"}${snapshot.search.warning ? " [peringatan 80%]" : ""}\n` +
      `  balasan bulan    : ${quotaText(snapshot.reply)} -> ${snapshot.reply.allowed ? "boleh" : "DITOLAK"}${snapshot.reply.warning ? " [peringatan 80%]" : ""}\n` +
      `  jadwal pencarian : ${hourly} tiap jam, ${daily} harian, ${manual} manual -> proyeksi ${projectedSearches} pencarian/bulan` +
      (snapshot.search.limit !== null && projectedSearches > snapshot.search.limit ? ` [MELEBIHI kuota ${snapshot.search.limit}]` : "") + "
" +
      `  silang pemakaian : SearchRun selesai ${searchRuns}, UsageEvent ${eventSearch}, counter ${snapshot.search.used} | balasan terkirim ${repliesSent}, UsageEvent ${eventReply}, counter ${snapshot.reply.used}`,
    );

    if (snapshot.search.limit !== null && projectedSearches > snapshot.search.limit) {
      problems.push(`${user.email}: jadwal kata kunci memproyeksikan ${projectedSearches} pencarian/bulan, di atas kuota paket ${snapshot.search.limit}`);
    }

    if (snapshot.search.used !== searchRuns) problems.push(`${user.email}: counter pencarian ${snapshot.search.used} != SearchRun selesai ${searchRuns}`);
    if (snapshot.reply.used !== repliesSent) problems.push(`${user.email}: counter balasan ${snapshot.reply.used} != balasan terkirim ${repliesSent}`);
    if (snapshot.search.used !== eventSearch) problems.push(`${user.email}: counter pencarian ${snapshot.search.used} != UsageEvent ${eventSearch}`);
    if (snapshot.reply.used !== eventReply) problems.push(`${user.email}: counter balasan ${snapshot.reply.used} != UsageEvent ${eventReply}`);
    if (snapshot.keywords.limit !== null && keywordsAll > snapshot.keywords.limit) {
      problems.push(`${user.email}: kata kunci ${keywordsAll} melebihi batas paket ${snapshot.keywords.limit}`);
    }
  }

  return problems;
}

async function main() {
  try {
    const planProblems = await auditPlans();
    const userProblems = await auditUsers();
    const problems = [...planProblems, ...userProblems];

    console.log("\n== Kesimpulan ==");
    if (problems.length === 0) {
      console.log("Batas pemakaian sesuai paket. Tidak ada selisih antara penghitung kuota dan jejak eksekusi.");
    } else {
      console.log(`${problems.length} temuan:`);
      for (const problem of problems) console.log(`- ${problem}`);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
