import { z } from "zod";
import type { ThreadSearchResult } from "@/server/integrations/threads/types";

/**
 * Bentuk masukan dan keluaran pencarian langsung milik konsol internal.
 *
 * Murni supaya dapat diuji tanpa jaringan: pemanggilan Threads ada di
 * `direct-search-service.ts`.
 */

export const directSearchSchema = z.object({
  query: z.string().trim().min(2, "Kata kunci minimal 2 karakter.").max(100, "Kata kunci maksimal 100 karakter."),
});

export type DirectSearchHit = {
  externalPostId: string;
  authorHandle: string;
  authorName: string;
  body: string;
  permalink: string;
  postedAt: string;
  /** `null` berarti Threads tidak mengirim metrik, bukan nol. */
  likeCount: number | null;
  replyCount: number | null;
  repostCount: number | null;
};

/**
 * Mengurutkan hasil dari yang terbaru dan membuangnya bila tidak berisi teks.
 *
 * Postingan tanpa teks tidak berguna sebagai lead dan hanya menambah baris
 * kosong di layar.
 */
export function toDirectHits(results: ThreadSearchResult[]): DirectSearchHit[] {
  return results
    .filter(result => result.body.trim().length > 0)
    .map(result => ({
      externalPostId: result.externalPostId,
      authorHandle: result.authorHandle,
      authorName: result.authorName || result.authorHandle,
      body: result.body.trim(),
      permalink: result.permalink,
      postedAt: result.postedAt.toISOString(),
      likeCount: result.likeCount ?? null,
      replyCount: result.replyCount ?? null,
      repostCount: result.repostCount ?? null,
    }))
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}
