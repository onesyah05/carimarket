import "server-only";
import { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyLeadIntent } from "@/lib/lead-intent";
import { isMatch, type AiVerdict } from "./ai-matching";
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
    postedAt: lead.threadPost.postedAt.toISOString(),
    text: lead.threadPost.body,
    keyword: lead.keywordMatches[0]?.keyword.phrase ?? "Threads",
    score: Math.round(Number(lead.relevanceScore)),
    likes: lead.threadPost.likeCount,
    replies: lead.threadPost.replyCount,
    reposts: lead.threadPost.repostCount,
    location: "Threads",
    // Niat postingan dihitung saat dibaca, bukan disimpan: aturannya masih
    // disempurnakan, dan menghitung ulang membuat perbaikan langsung berlaku
    // untuk lead lama tanpa backfill.
    intent: classifyLeadIntent(lead.threadPost.body),
    isReply: lead.threadPost.isReply,
    replyToHandle: lead.threadPost.replyToHandle,
    threadSize: lead.threadPost.threadSize,
    viewedAt: lead.viewedAt?.toISOString() ?? null,
    status: displayStatus(lead.status),
    matchReason: lead.matchReason,
    // Vonis AI dikirim apa adanya; `matched` adalah jawaban yang sudah
    // menggabungkan vonis dan ambang angka, supaya feed dan email memakai
    // aturan yang sama persis.
    aiVerdict: (lead.aiVerdict ?? null) as "MATCH" | "NO_MATCH" | "UNSURE" | null,
    aiReason: lead.aiReason,
    matched: isMatch((lead.aiVerdict ?? "UNKNOWN") as AiVerdict, lead.aiScore ?? Number(lead.relevanceScore)),
    sourceMode: lead.sourceMode,
    flagged: options?.flagged ?? false,
  };
}

/** Lead milik satu jasa. Jasa lain dalam akun yang sama punya feed sendiri. */
export async function listWorkspaceLeads(profileId: string, take = 50) {
  const [leads, blacklistTerms] = await Promise.all([
    prisma.lead.findMany({
      where: { businessProfileId: profileId },
      include: leadInclude,
      orderBy: { discoveredAt: "desc" },
      take,
    }),
    loadBlacklistTerms(),
  ]);
  return leads.map(lead => serializeLead(lead, { flagged: isRiskyText(lead.threadPost.body, blacklistTerms) }));
}

export async function getWorkspaceLead(profileId: string, leadId: string) {
  const [lead, blacklistTerms] = await Promise.all([
    prisma.lead.findFirst({ where: { id: leadId, businessProfileId: profileId }, include: leadInclude }),
    loadBlacklistTerms(),
  ]);
  return lead ? serializeLead(lead, { flagged: isRiskyText(lead.threadPost.body, blacklistTerms) }) : null;
}
