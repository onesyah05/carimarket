import "server-only";
import { KeywordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { KeywordSuggestion } from "@/lib/keyword-suggestions";

/**
 * Riwayat kata kunci positif milik pengguna, untuk disarankan di kolom
 * pencarian lead.
 *
 * Hanya `INCLUDE`: kata kunci negatif adalah penyaring, bukan sesuatu yang
 * dicari. Kata kunci yang dijeda tetap ikut karena pengguna pernah memakainya
 * — tujuannya mengingatkan, bukan menyaring.
 */
const SUGGESTION_LIMIT = 50;

export async function listKeywordSuggestions(userId: string): Promise<KeywordSuggestion[]> {
  const keywords = await prisma.keyword.findMany({
    where: { userId, kind: KeywordKind.INCLUDE },
    select: {
      phrase: true,
      isActive: true,
      lastRunAt: true,
      createdAt: true,
      _count: { select: { leadMatches: true } },
    },
    // Yang terakhir dipakai paling atas; yang belum pernah dijalankan menyusul
    // berdasarkan kapan ditambahkan.
    orderBy: [{ lastRunAt: "desc" }, { createdAt: "desc" }],
    take: SUGGESTION_LIMIT,
  });

  return keywords.map(keyword => ({
    phrase: keyword.phrase,
    matches: keyword._count.leadMatches,
    lastUsedAt: keyword.lastRunAt?.toISOString() ?? null,
    active: keyword.isActive,
  }));
}
