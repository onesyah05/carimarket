import "server-only";
import { KeywordKind, SearchCapability, SearchFrequency, SearchRunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getThreadsAdapter } from "@/server/integrations/threads";
import { isThreadsAvailable } from "@/server/integrations/threads/config";
import { recordUsage } from "@/server/usage/service";

export function relevanceScore(body: string, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = terms.filter(term => body.toLowerCase().includes(term)).length;
  return Math.min(100, Math.round(70 + (matches / Math.max(terms.length, 1)) * 30));
}

function nextRunAt(frequency: SearchFrequency) {
  if (frequency === SearchFrequency.HOURLY) return new Date(Date.now() + 60 * 60 * 1000);
  if (frequency === SearchFrequency.DAILY) return new Date(Date.now() + 24 * 60 * 60 * 1000);
  return null;
}

export async function runKeywordSearch(keywordId: string) {
  const keyword = await prisma.keyword.findUnique({ where: { id: keywordId } });
  if (!keyword) throw new Error("KEYWORD_NOT_FOUND");

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
    const results = (await adapter.searchPosts(keyword.phrase)).filter(result => result.body.trim().length > 0);
    for (const result of results) {
      await prisma.$transaction(async tx => {
        const post = await tx.threadPost.upsert({
          where: { externalPostId: result.externalPostId },
          update: { authorHandle: result.authorHandle, authorName: result.authorName, body: result.body, permalink: result.permalink, postedAt: result.postedAt, capturedAt: new Date() },
          create: { externalPostId: result.externalPostId, authorHandle: result.authorHandle, authorName: result.authorName, body: result.body, permalink: result.permalink, postedAt: result.postedAt },
        });
        const score = relevanceScore(result.body, keyword.phrase);
        const lead = await tx.lead.upsert({
          where: { userId_threadPostId: { userId: keyword.userId, threadPostId: post.id } },
          update: { relevanceScore: score, matchReason: `Cocok dengan kata kunci ${keyword.phrase}`, sourceMode: result.capability },
          create: { userId: keyword.userId, threadPostId: post.id, relevanceScore: score, matchReason: `Cocok dengan kata kunci ${keyword.phrase}`, sourceMode: result.capability },
        });
        await tx.leadKeywordMatch.upsert({
          where: { leadId_keywordId: { leadId: lead.id, keywordId: keyword.id } },
          update: { score },
          create: { leadId: lead.id, keywordId: keyword.id, score },
        });
      });
    }

    await prisma.$transaction([
      prisma.searchRun.update({ where: { id: run.id }, data: { status: SearchRunStatus.COMPLETED, resultCount: results.length, completedAt: new Date() } }),
      prisma.keyword.update({ where: { id: keyword.id }, data: { lastRunAt: new Date(), nextRunAt: nextRunAt(keyword.frequency) } }),
    ]);
    await recordUsage(keyword.userId, "SEARCH", 1, run.id);
    return { resultCount: results.length };
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code).slice(0, 100) : "SEARCH_FAILED";
    await prisma.$transaction([
      prisma.searchRun.update({ where: { id: run.id }, data: { status: SearchRunStatus.FAILED, errorCode: code, completedAt: new Date() } }),
      prisma.keyword.update({ where: { id: keyword.id }, data: { lastRunAt: new Date(), nextRunAt: nextRunAt(keyword.frequency) } }),
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
    select: { id: true },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });
  return keywords.map(keyword => keyword.id);
}
