import "server-only";
import { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRiskyText, loadBlacklistTerms } from "@/server/replies/blacklist";

const leadInclude = {
  threadPost: true,
  keywordMatches: { include: { keyword: true }, take: 1 },
} satisfies Prisma.LeadInclude;

export type StoredLead = Prisma.LeadGetPayload<{ include: typeof leadInclude }>;

function relativeTime(date: Date) {
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

function displayStatus(status: LeadStatus): "Baru" | "Tersimpan" | "Dibalas" {
  if (status === LeadStatus.REPLIED) return "Dibalas";
  if (status === LeadStatus.SAVED) return "Tersimpan";
  return "Baru";
}

export function serializeLead(lead: StoredLead, options?: { flagged?: boolean }) {
  const author = lead.threadPost.authorName || lead.threadPost.authorHandle.replace(/^@/, "") || "Pengguna Threads";
  const avatar = author.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "TH";
  return {
    id: lead.id,
    externalPostId: lead.threadPost.externalPostId,
    permalink: lead.threadPost.permalink,
    author,
    handle: lead.threadPost.authorHandle,
    avatar,
    time: relativeTime(lead.threadPost.postedAt),
    text: lead.threadPost.body,
    keyword: lead.keywordMatches[0]?.keyword.phrase ?? "Threads",
    score: Math.round(Number(lead.relevanceScore)),
    likes: lead.threadPost.likeCount,
    replies: lead.threadPost.replyCount,
    location: "Threads",
    status: displayStatus(lead.status),
    matchReason: lead.matchReason,
    sourceMode: lead.sourceMode,
    flagged: options?.flagged ?? false,
  };
}

export async function listWorkspaceLeads(userId: string, take = 50) {
  const [leads, blacklistTerms] = await Promise.all([
    prisma.lead.findMany({
      where: { userId },
      include: leadInclude,
      orderBy: { discoveredAt: "desc" },
      take,
    }),
    loadBlacklistTerms(),
  ]);
  return leads.map(lead => serializeLead(lead, { flagged: isRiskyText(lead.threadPost.body, blacklistTerms) }));
}

export async function getWorkspaceLead(userId: string, leadId: string) {
  const [lead, blacklistTerms] = await Promise.all([
    prisma.lead.findFirst({ where: { id: leadId, userId }, include: leadInclude }),
    loadBlacklistTerms(),
  ]);
  return lead ? serializeLead(lead, { flagged: isRiskyText(lead.threadPost.body, blacklistTerms) }) : null;
}
