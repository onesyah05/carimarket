import Link from "next/link";
import { ArrowLeft, Heart, MapPin, MessageCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { ReplyComposer } from "@/features/replies/components/reply-composer";
import { LeadSaveButton } from "@/features/leads/components/lead-save-button";
import { getWorkspaceLead } from "@/server/leads/queries";
import { getLeadReplyContext } from "@/server/replies/lead-context";
import { getWorkspaceUser } from "@/server/workspace-user";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getWorkspaceUser();
  const lead = await getWorkspaceLead(user.id, id);
  if (!lead) notFound();
  const context = await getLeadReplyContext(user.id, id);
  const scoreLabel = lead.score >= 80 ? "Kecocokan tinggi" : lead.score >= 60 ? "Kecocokan sedang" : "Perlu ditinjau";
  return <><Link className="back-link" href="/dashboard/leads"><ArrowLeft size={16} /> Kembali ke lead feed</Link><div className="review-layout"><section className="context-column"><div className="review-label">Konteks postingan</div><article className="thread-post"><header><span className="lead-avatar">{lead.avatar}</span><div><strong>{lead.author}</strong><span>{lead.handle} · {lead.time}</span></div></header><p>{lead.text}</p><div className="thread-stats"><span><Heart size={15} /> {lead.likes}</span><span><MessageCircle size={15} /> {lead.replies}</span><span><MapPin size={15} /> {lead.location}</span></div></article><div className="match-panel"><div><span className="score-ring">{lead.score}</span><div><strong>{scoreLabel}</strong><p>{lead.matchReason ?? "Periksa kecocokan postingan dengan bisnis Anda sebelum membalas."}</p></div></div><dl><div><dt>Kata kunci</dt><dd>{lead.keyword}</dd></div><div><dt>Sumber</dt><dd>{lead.sourceMode === "PUBLIC_SEARCH" ? "Pencarian publik Threads" : lead.sourceMode === "SELF_ONLY" ? "Akun Threads sendiri" : "Data lokal"}</dd></div>{lead.permalink && <div><dt>Postingan</dt><dd><a className="text-link" href={lead.permalink} target="_blank" rel="noreferrer">Buka di Threads</a></dd></div>}</dl><LeadSaveButton leadId={lead.id} initialStatus={lead.status} /></div></section><section className="composer-column"><div className="review-label">Kelola balasan</div><ReplyComposer leadId={lead.id} postId={lead.externalPostId} author={lead.author} keyword={lead.keyword} profile={context.profile} initialDraft={context.draft} connected={context.connected} /></section></div></>;
}
