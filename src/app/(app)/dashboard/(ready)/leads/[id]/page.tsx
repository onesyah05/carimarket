import Link from "next/link";
import { ArrowLeft, Heart, MapPin, MessageCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LEAD_INTENT_LABEL } from "@/lib/lead-intent";
import { leadThreadContext } from "@/components/dashboard-ui";
import { ReplyComposer } from "@/features/replies/components/reply-composer";
import { LeadSaveButton } from "@/features/leads/components/lead-save-button";
import { getWorkspaceLead } from "@/server/leads/queries";
import { getLeadReplyContext } from "@/server/replies/lead-context";
import { getWorkspaceUser } from "@/server/workspace-user";
import { resolveActiveProfile } from "@/server/workspace/profiles";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getWorkspaceUser();
  const profile = await resolveActiveProfile(user);
  if (!profile) notFound();
  const lead = await getWorkspaceLead(profile.id, id);
  if (!lead) notFound();
  const context = await getLeadReplyContext(user.id, id);
  // Membuka halaman ini berarti lead-nya dibaca. Penandaannya idempoten, jadi
  // render ganda tidak menggeser waktu baca pertama.
  if (lead.viewedAt === null) {
    await prisma.lead.updateMany({ where: { id, businessProfileId: profile.id, viewedAt: null }, data: { viewedAt: new Date() } });
  }
  const scoreLabel = lead.score >= 80 ? "Kecocokan tinggi" : lead.score >= 60 ? "Kecocokan sedang" : "Perlu ditinjau";
  return <><Link className="back-link" href="/dashboard/leads"><ArrowLeft size={16} /> Kembali ke lead feed</Link><div className="review-layout"><section className="context-column"><div className="review-label">Konteks postingan</div><article className="thread-post"><header><span className="lead-avatar">{lead.avatar}</span><div><strong>{lead.author}</strong><span>{lead.handle} · {lead.time}</span></div></header><p>{lead.text}</p><div className="thread-stats">{lead.likes !== null && <span><Heart size={15} /> {lead.likes}</span>}{lead.replies !== null && <span><MessageCircle size={15} /> {lead.replies}</span>}{lead.likes === null && lead.replies === null && <span>Metrik keterlibatan tidak dikirim Threads</span>}<span><MapPin size={15} /> {lead.location}</span></div></article><div className="match-panel"><div><span className="score-ring">{lead.score}</span><div><strong>{scoreLabel}</strong><p>{lead.matchReason ?? "Periksa kecocokan postingan dengan bisnis Anda sebelum membalas."}</p></div></div><dl><div><dt>Kata kunci</dt><dd>{lead.keyword}</dd></div><div><dt>Jenis postingan</dt><dd>{LEAD_INTENT_LABEL[lead.intent]}</dd></div><div><dt>Konteks percakapan</dt><dd>{leadThreadContext(lead)}{lead.replies !== null && lead.replies > 0 ? ` · ${lead.replies} balasan` : ""}</dd></div><div><dt>Sumber</dt><dd>{lead.sourceMode === "PUBLIC_SEARCH" ? "Pencarian publik Threads" : lead.sourceMode === "SELF_ONLY" ? "Akun Threads sendiri" : "Data lokal"}</dd></div>{lead.permalink && <div><dt>Postingan</dt><dd><a className="text-link" href={lead.permalink} target="_blank" rel="noreferrer">Buka di Threads</a></dd></div>}</dl><LeadSaveButton leadId={lead.id} initialStatus={lead.status} /></div></section><section className="composer-column"><div className="review-label">Kelola balasan</div><ReplyComposer leadId={lead.id} postId={lead.externalPostId} author={lead.author} keyword={lead.keyword} profile={context.profile} initialDraft={context.draft} connected={context.connected} /></section></div></>;
}
