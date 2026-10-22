import "server-only";
import { prisma } from "@/lib/prisma";
import { sendLeadDigest } from "@/server/leads/digest";
import { findDueKeywordIds, runKeywordSearch } from "@/server/leads/search-service";

/**
 * Siklus pencarian terjadwal.
 *
 * Lead yang ditemukan dikumpulkan per pemilik lalu diringkas menjadi satu
 * email di akhir siklus. Sebelumnya tiap kata kunci mengirim notifikasinya
 * sendiri, jadi satu siklus worker bisa mengirim beberapa email beruntun ke
 * orang yang sama.
 */
export async function runDueSearches(limit = 20) {
  const summary = { candidates: 0, searched: 0, failed: 0, results: 0, excluded: 0, digests: 0 };
  const keywordIds = await findDueKeywordIds(limit);
  summary.candidates = keywordIds.length;

  const leadsByUser = new Map<string, string[]>();

  for (const keywordId of keywordIds) {
    try {
      const result = await runKeywordSearch(keywordId);
      summary.searched += 1;
      summary.results += result.resultCount;
      summary.excluded += result.excludedCount;
      if (result.createdLeadIds.length > 0) {
        const keyword = await prisma.keyword.findUnique({ where: { id: keywordId }, select: { userId: true } }).catch(() => null);
        if (keyword) leadsByUser.set(keyword.userId, [...(leadsByUser.get(keyword.userId) ?? []), ...result.createdLeadIds]);
      }
    } catch {
      summary.failed += 1;
    }
  }

  for (const [userId, leadIds] of leadsByUser) {
    const digest = await sendLeadDigest(userId, leadIds).catch(() => null);
    if (digest && digest.matched > 0) summary.digests += 1;
  }

  return summary;
}
