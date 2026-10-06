import "server-only";
import { findDueKeywordIds, runKeywordSearch } from "@/server/leads/search-service";

export async function runDueSearches(limit = 20) {
  const summary = { candidates: 0, searched: 0, failed: 0, results: 0 };
  const keywordIds = await findDueKeywordIds(limit);
  summary.candidates = keywordIds.length;

  for (const keywordId of keywordIds) {
    try {
      const result = await runKeywordSearch(keywordId);
      summary.searched += 1;
      summary.results += result.resultCount;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
