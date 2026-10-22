import "server-only";
import { KeywordKind, SearchCapability, SearchFrequency, SearchRunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getThreadsAdapter } from "@/server/integrations/threads";
import { isThreadsAvailable } from "@/server/integrations/threads/config";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { hasSearchQuota, releaseSearchQuota, reserveSearchQuota, resolveSearchIntervalHours } from "@/server/usage/limits";
import { logUsageEvent } from "@/server/usage/service";
import { judgeLead, type AiVerdict, type BusinessContext } from "./ai-matching";
import { sendLeadDigest } from "./digest";
import { matchedExcludedTerm, relevanceScore } from "./matching";
import { nextRunAt } from "./schedule";

export { relevanceScore } from "./matching";

export type KeywordSearchResult = {
  /** Jumlah postingan yang masuk ke feed setelah penyaringan. */
  resultCount: number;
  /** Jumlah postingan yang dibuang karena memuat kata kunci negatif. */
  excludedCount: number;
  /** Jumlah lead yang benar-benar baru pada pencarian ini. */
  createdCount: number;
  /** Id lead yang baru dibuat, untuk diringkas jadi satu email oleh pemanggil. */
  createdLeadIds: string[];
  /** Terisi bila penilaian AI tidak dapat dijalankan dan skor turun ke heuristik. */
  aiFailure?: string | null;
};

/** Profil bisnis sebagai konteks penilaian; kolom kosong diisi penanda netral. */
async function loadBusinessContext(profileId: string): Promise<BusinessContext> {
  const profile = await prisma.businessProfile.findUnique({
    where: { id: profileId },
    select: { name: true, category: true, serviceArea: true, description: true },
  });
  return {
    name: profile?.name ?? "(tidak diisi)",
    category: profile?.category ?? "(tidak diisi)",
    serviceArea: profile?.serviceArea ?? "(tidak diisi)",
    description: profile?.description ?? "(tidak diisi)",
  };
}

/**
 * Batas jumlah postingan yang dinilai AI dalam satu pencarian.
 *
 * Postingan selebihnya tetap menjadi lead dengan skor heuristik: menahan
 * seluruh hasil hanya karena anggaran penilaian habis akan menyembunyikan
 * lead yang mungkin justru dicari.
 */
const AI_JUDGEMENT_LIMIT = 25;

async function judgeResults(business: BusinessContext, phrase: string, results: Array<{ externalPostId: string; body: string }>) {
  const judgements = new Map<string, Awaited<ReturnType<typeof judgeLead>>>();
  for (const result of results.slice(0, AI_JUDGEMENT_LIMIT)) {
    const judgement = await judgeLead(business, phrase, result.body);
    judgements.set(result.externalPostId, judgement);
    // Satu kegagalan yang bersifat akun — saldo habis, key ditolak — akan
    // terulang pada tiap postingan berikutnya, jadi sisanya tidak dicoba.
    if (judgement.failure === "NO_FUNDS" || judgement.failure === "UNAUTHORIZED" || judgement.failure === "UNCONFIGURED" || judgement.failure === "FREE_TIER_BLOCKED") break;
  }
  return judgements;
}

/** Kata kunci negatif aktif milik pengguna, dipakai untuk menyaring hasil pencarian. */
export async function loadExcludedTerms(profileId: string) {
  const keywords = await prisma.keyword.findMany({
    where: { businessProfileId: profileId, kind: KeywordKind.EXCLUDE, isActive: true },
    select: { normalized: true },
  });
  return keywords.map(keyword => keyword.normalized);
}

export async function runKeywordSearch(keywordId: string): Promise<KeywordSearchResult> {
  const keyword = await prisma.keyword.findUnique({ where: { id: keywordId } });
  if (!keyword) throw new Error("KEYWORD_NOT_FOUND");

  // Lead selalu dimiliki satu jasa; kata kunci tanpa jasa berarti data lama
  // yang tidak terhubung ke ruang kerja mana pun.
  const profileId = keyword.businessProfileId;
  if (!profileId) {
    throw new ThreadsIntegrationError(
      "KEYWORD_WITHOUT_PROFILE",
      "Kata kunci ini belum terhubung ke jasa mana pun. Hapus lalu tambahkan ulang dari halaman Kata kunci.",
      409,
    );
  }

  // Jatah dipesan sebelum SearchRun dibuat agar pemakaian yang ditolak tidak
  // tercatat sebagai percobaan pencarian, dan agar dua pencarian bersamaan
  // tidak sama-sama lolos batas.
  await reserveSearchQuota(keyword.userId);
  const [excludedTerms, planIntervalHours, business] = await Promise.all([
    loadExcludedTerms(profileId),
    resolveSearchIntervalHours(keyword.userId),
    loadBusinessContext(profileId),
  ]);

  const run = await prisma.searchRun.create({
    data: {
      userId: keyword.userId,
      keywordId: keyword.id,
      capability: SearchCapability.PUBLIC_SEARCH,
      status: SearchRunStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  try {
    const adapter = await getThreadsAdapter(keyword.userId);
    const fetched = await adapter.searchPosts(keyword.phrase);

    const results: typeof fetched = [];
    let excludedCount = 0;
    for (const result of fetched) {
      if (result.body.trim().length === 0) continue;
      if (matchedExcludedTerm(result.body, excludedTerms)) {
        excludedCount += 1;
        continue;
      }
      results.push(result);
    }

    // Penilaian AI dijalankan sebelum transaksi, bukan di dalamnya: satu
    // panggilan jaringan per lead di dalam transaksi akan menahan kunci baris
    // selama penyedia AI berpikir. Batasnya menjaga satu kata kunci yang
    // mengembalikan ratusan postingan tidak menghabiskan saldo sekaligus.
    const judgements = await judgeResults(business, keyword.phrase, results);
    const aiFailure = [...judgements.values()].find(judgement => judgement.failure !== null)?.failure ?? null;

    let createdCount = 0;
    const createdLeadIds: string[] = [];
    for (const result of results) {
      const created = await prisma.$transaction(async tx => {
        // Metrik keterlibatan hanya ditulis bila adapter benar-benar
        // mengirimkannya, agar nilai yang sudah tersimpan tidak tertimpa nol.
        const engagement = {
          ...(result.likeCount === undefined ? {} : { likeCount: result.likeCount }),
          ...(result.replyCount === undefined ? {} : { replyCount: result.replyCount }),
          ...(result.repostCount === undefined ? {} : { repostCount: result.repostCount }),
        };
        // Konteks percakapan hanya ditulis bila adapter mengirimkannya, dengan
        // alasan yang sama seperti metrik: jangan menimpa yang sudah diketahui
        // dengan ketidaktahuan.
        const context = {
          ...(result.isReply === undefined ? {} : { isReply: result.isReply }),
          ...(result.replyToHandle === undefined ? {} : { replyToHandle: result.replyToHandle }),
          ...(result.threadSize === undefined ? {} : { threadSize: result.threadSize }),
        };
        const post = await tx.threadPost.upsert({
          where: { externalPostId: result.externalPostId },
          update: { authorHandle: result.authorHandle, authorName: result.authorName, body: result.body, permalink: result.permalink, postedAt: result.postedAt, capturedAt: new Date(), ...engagement, ...context },
          create: { externalPostId: result.externalPostId, authorHandle: result.authorHandle, authorName: result.authorName, body: result.body, permalink: result.permalink, postedAt: result.postedAt, ...engagement, ...context },
        });
        const existing = await tx.lead.findUnique({
          where: { businessProfileId_threadPostId: { businessProfileId: profileId, threadPostId: post.id } },
          select: { id: true },
        });
        const judgement = judgements.get(result.externalPostId);
        const score = judgement?.score ?? relevanceScore(result.body, keyword.phrase);
        // Vonis hanya ditulis bila AI benar-benar menjawab; `UNKNOWN` tidak
        // disimpan agar baris yang belum pernah dinilai tetap dapat dibedakan
        // dari baris yang dinilai dan dianggap tidak cocok.
        const ai = judgement && judgement.verdict !== "UNKNOWN"
          ? { aiVerdict: judgement.verdict as Exclude<AiVerdict, "UNKNOWN">, aiScore: judgement.score, aiReason: judgement.reason, aiModel: judgement.model, aiEvaluatedAt: new Date() }
          : {};
        const reason = judgement?.reason ?? `Cocok dengan kata kunci ${keyword.phrase}`;
        const lead = await tx.lead.upsert({
          where: { businessProfileId_threadPostId: { businessProfileId: profileId, threadPostId: post.id } },
          update: { relevanceScore: score, matchReason: reason, sourceMode: result.capability, ...ai },
          create: { userId: keyword.userId, businessProfileId: profileId, threadPostId: post.id, relevanceScore: score, matchReason: reason, sourceMode: result.capability, ...ai },
        });
        await tx.leadKeywordMatch.upsert({
          where: { leadId_keywordId: { leadId: lead.id, keywordId: keyword.id } },
          update: { score },
          create: { leadId: lead.id, keywordId: keyword.id, score },
        });
        return existing === null ? lead.id : null;
      });
      if (created) {
        createdCount += 1;
        createdLeadIds.push(created);
      }
    }

    await prisma.$transaction([
      prisma.searchRun.update({ where: { id: run.id }, data: { status: SearchRunStatus.COMPLETED, resultCount: results.length, completedAt: new Date() } }),
      prisma.keyword.update({ where: { id: keyword.id }, data: { lastRunAt: new Date(), nextRunAt: nextRunAt(keyword.frequency, planIntervalHours) } }),
    ]);
    await logUsageEvent(keyword.userId, "SEARCH", 1, run.id);

    return { resultCount: results.length, excludedCount, createdCount, createdLeadIds, aiFailure };
  } catch (error) {
    // Pencarian yang gagal tidak boleh memakan kuota: jatah yang sudah dipesan
    // dikembalikan sebelum kegagalannya diteruskan.
    await releaseSearchQuota(keyword.userId);
    const code = error instanceof Error && "code" in error ? String(error.code).slice(0, 100) : "SEARCH_FAILED";
    await prisma.$transaction([
      prisma.searchRun.update({ where: { id: run.id }, data: { status: SearchRunStatus.FAILED, errorCode: code, completedAt: new Date() } }),
      prisma.keyword.update({ where: { id: keyword.id }, data: { lastRunAt: new Date(), nextRunAt: nextRunAt(keyword.frequency, planIntervalHours) } }),
    ]).catch(() => undefined);
    throw error;
  }
}

export async function findDueKeywordIds(limit = 20) {
  if (!(await isThreadsAvailable())) return [];
  const now = new Date();
  const keywords = await prisma.keyword.findMany({
    where: {
      isActive: true,
      kind: KeywordKind.INCLUDE,
      frequency: { not: SearchFrequency.MANUAL },
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    select: { id: true, userId: true },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  // Pengguna yang kuotanya habis dilewati tanpa membuat SearchRun gagal.
  const quotaByUser = new Map<string, boolean>();
  const dueIds: string[] = [];
  for (const keyword of keywords) {
    let allowed = quotaByUser.get(keyword.userId);
    if (allowed === undefined) {
      allowed = await hasSearchQuota(keyword.userId);
      quotaByUser.set(keyword.userId, allowed);
    }
    if (allowed) dueIds.push(keyword.id);
  }
  return dueIds;
}

export type BulkSearchResult = {
  /** Kata kunci aktif yang benar-benar dijalankan. */
  ran: number;
  total: number;
  resultCount: number;
  excludedCount: number;
  createdCount: number;
  /** Terisi bila penelusuran berhenti sebelum semua kata kunci dijalankan. */
  stopped: string | null;
  /** Kata kunci yang dialihkan ke pekerja latar karena permintaan sudah terlalu lama. */
  deferred: number;
};

/**
 * Anggaran satu permintaan.
 *
 * Setiap kata kunci berarti satu perjalanan ke Threads yang dapat memakan
 * beberapa detik. Paket Pro mengizinkan 25 kata kunci, jadi menjalankan
 * semuanya berurutan di dalam satu permintaan hampir pasti melampaui batas
 * waktu reverse proxy — dan pengguna melihat kegagalan padahal pencariannya
 * berjalan. Sisanya dialihkan ke pekerja latar dengan menjadikan jadwalnya
 * jatuh tempo sekarang.
 */
const MAX_KEYWORDS_PER_REQUEST = 5;
const REQUEST_TIME_BUDGET_MS = 25_000;

/**
 * Menjalankan seluruh kata kunci pencarian yang aktif sekaligus.
 *
 * Inilah yang sebenarnya diinginkan pelanggan saat menekan "Cari leads
 * sekarang": satu tindakan untuk semua kata kunci yang sudah mereka susun,
 * bukan mengetik ulang satu frasa dan diam-diam membuat kata kunci baru yang
 * memakan jatah paket.
 *
 * Kuota yang habis di tengah jalan menghentikan sisanya, bukan menggagalkan
 * semuanya: hasil kata kunci yang sempat berjalan tetap tersimpan dan
 * pemanggil melaporkan apa adanya.
 */
export async function runAllActiveKeywords(profileId: string): Promise<BulkSearchResult> {
  const keywords = await prisma.keyword.findMany({
    where: { businessProfileId: profileId, kind: KeywordKind.INCLUDE, isActive: true },
    select: { id: true },
    // Yang paling lama tidak dijalankan didahulukan, supaya kuota yang terbatas
    // tidak selalu habis untuk kata kunci yang sama.
    orderBy: [{ lastRunAt: "asc" }, { createdAt: "asc" }],
  });

  if (keywords.length === 0) {
    throw new ThreadsIntegrationError(
      "NO_ACTIVE_KEYWORD",
      "Belum ada kata kunci pencarian yang aktif. Tambahkan kata kunci dulu di halaman Kata kunci.",
      409,
    );
  }

  const totals: BulkSearchResult = { ran: 0, total: keywords.length, resultCount: 0, excludedCount: 0, createdCount: 0, stopped: null, deferred: 0 };
  const createdLeadIds: string[] = [];
  const deadline = Date.now() + REQUEST_TIME_BUDGET_MS;
  const pending: string[] = [];

  for (const [index, keyword] of keywords.entries()) {
    // Anggaran diperiksa sebelum perjalanan berikutnya dimulai, bukan sesudah:
    // yang perlu dihindari adalah memulai pekerjaan yang pasti tidak selesai.
    if (index >= MAX_KEYWORDS_PER_REQUEST || Date.now() >= deadline) {
      pending.push(...keywords.slice(index).map(row => row.id));
      break;
    }
    try {
      const result = await runKeywordSearch(keyword.id);
      totals.ran += 1;
      totals.resultCount += result.resultCount;
      totals.excludedCount += result.excludedCount;
      totals.createdCount += result.createdCount;
      createdLeadIds.push(...result.createdLeadIds);
    } catch (error) {
      // Penyebabnya dicatat supaya kegagalan massal dapat didiagnosis; pesan
      // untuk pengguna tetap umum bila errornya bukan error integrasi.
      console.warn(`Pencarian massal gagal pada kata kunci ${keyword.id}: ${error instanceof Error ? `${error.name}: ${error.message.slice(0, 160)}` : "penyebab tidak diketahui"}`);
      totals.stopped ??= error instanceof ThreadsIntegrationError
        ? error.message
        : "Sebagian kata kunci gagal dijalankan. Coba lagi beberapa saat.";

      // Kuota habis berlaku untuk seluruh akun, jadi melanjutkan hanya
      // mengulang kegagalan yang sama. Kegagalan lain bisa kebetulan mengenai
      // satu kata kunci saja, dan sisanya tetap layak dicoba.
      if (error instanceof ThreadsIntegrationError && error.code === "SEARCH_QUOTA_EXCEEDED") break;
      if (error instanceof ThreadsIntegrationError && error.code === "PLATFORM_DAILY_LIMIT_REACHED") break;
    }
  }

  if (pending.length > 0) {
    // Jadwalnya dijatuhkan ke sekarang supaya siklus worker berikutnya
    // mengambilnya; pengguna tidak perlu menekan tombolnya berulang kali.
    await prisma.keyword.updateMany({ where: { id: { in: pending } }, data: { nextRunAt: new Date() } }).catch(() => undefined);
    totals.deferred = pending.length;
    totals.stopped ??= `${totals.ran} dari ${totals.total} kata kunci selesai dicari. ${pending.length} sisanya dijalankan otomatis oleh sistem dalam beberapa menit.`;
  }

  // Satu ringkasan untuk seluruh siklus, setelah semua kata kunci selesai.
  // Kegagalannya tidak boleh menggagalkan pencarian yang sudah tersimpan.
  const userId = await prisma.businessProfile.findUnique({ where: { id: profileId }, select: { userId: true } }).then(row => row?.userId ?? null).catch(() => null);
  if (userId) await sendLeadDigest(userId, createdLeadIds).catch(() => undefined);

  return totals;
}
