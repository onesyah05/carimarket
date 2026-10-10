import "server-only";
import { ArticleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";

/**
 * Menerbitkan artikel yang jadwal terbitnya sudah lewat.
 *
 * Tanpa job ini, artikel berstatus `SCHEDULED` tidak akan pernah muncul di
 * blog publik karena query publik hanya membaca status `PUBLISHED`.
 */
export async function publishScheduledArticles(limit = 25) {
  const summary = { articlesPublished: 0 };
  const now = new Date();

  const due = await prisma.article.findMany({
    where: { status: ArticleStatus.SCHEDULED, scheduledFor: { lte: now } },
    select: { id: true, title: true, scheduledFor: true },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  for (const article of due) {
    // Hanya artikel yang masih berstatus SCHEDULED yang diterbitkan, agar
    // keputusan Superadmin yang terjadi bersamaan tidak tertimpa.
    const result = await prisma.article.updateMany({
      where: { id: article.id, status: ArticleStatus.SCHEDULED },
      data: { status: ArticleStatus.PUBLISHED, publishedAt: article.scheduledFor ?? now, scheduledFor: null },
    }).catch(() => ({ count: 0 }));
    if (result.count === 0) continue;

    summary.articlesPublished += 1;
    await recordAudit({
      actorId: null,
      action: "ARTICLE_AUTO_PUBLISHED",
      entityType: "Article",
      entityId: article.id,
      metadata: { title: article.title },
    });
  }

  return summary;
}
