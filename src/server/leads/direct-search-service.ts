import "server-only";
import { getThreadsAdapter } from "@/server/integrations/threads";
import type { SearchCapability } from "@/server/integrations/threads/types";
import { toDirectHits, type DirectSearchHit } from "./direct-search";

/**
 * Pencarian Threads langsung untuk konsol internal.
 *
 * Berbeda dengan pencarian pelanggan, jalur ini tidak menyentuh kuota, tidak
 * membuat Keyword, dan tidak menyimpan Lead: Superadmin memakainya untuk
 * memeriksa apa yang sebenarnya dikembalikan Threads, bukan untuk membangun
 * feed. Karena tidak ada yang tersimpan, tidak ada pula batas jumlah kata
 * kunci yang dapat dicoba.
 */
export async function runDirectSearch(
  actorId: string,
  query: string,
): Promise<{ capability: SearchCapability; hits: DirectSearchHit[] }> {
  const adapter = await getThreadsAdapter(actorId);
  const [capability, results] = await Promise.all([adapter.getCapability(), adapter.searchPosts(query)]);
  return { capability, hits: toDirectHits(results) };
}
