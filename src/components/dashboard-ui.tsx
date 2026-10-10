import Link from "next/link";
import { Heart, MapPin, MessageCircle } from "lucide-react";
import type { Lead } from "@/lib/workspace-data";

export function PageHeading({ eyebrow, title, copy, action }: { eyebrow?: string; title: string; copy?: string; action?: React.ReactNode }) {
  return <div className="dash-heading"><div>{eyebrow && <p>{eyebrow}</p>}<h1>{title}</h1>{copy && <span>{copy}</span>}</div>{action}</div>;
}

export function MetricCard({ label, value, change, icon }: { label: string; value: string; change?: string; icon: React.ReactNode }) {
  return <article className="metric-card"><div className="metric-card__top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong>{change && <small>{change}</small>}</article>;
}

export function QuotaMeter({ label, used, total, color = "blue" }: { label: string; used: number; total: number; color?: "blue" | "yellow" }) {
  const percentage = total > 0 ? Math.min(100, Math.round(used / total * 100)) : 0;
  return <div className="quota-meter"><div><span>{label}</span><strong>{used.toLocaleString("id-ID")} <small>/ {total.toLocaleString("id-ID")}</small></strong></div><div className="quota-track"><span className={color === "yellow" ? "quota-yellow" : ""} style={{ width: `${percentage}%` }} /></div><small>{percentage}% terpakai</small></div>;
}

export function LeadCard({ lead, compact = false }: { lead: Lead; compact?: boolean }) {
  // Metrik hanya ditampilkan bila Threads benar-benar mengirimkannya.
  const hasEngagement = lead.likes !== null || lead.replies !== null;
  return <article className={`lead-card ${compact ? "lead-card--compact" : ""}`}><header><span className="lead-avatar">{lead.avatar}</span><div><strong>{lead.author}</strong><span>{lead.handle} · {lead.time}</span></div></header><p>{lead.text}</p><div className="lead-tags"><span className="score-chip">{lead.score}% cocok</span><span className="keyword-chip">“{lead.keyword}”</span><span className={`lead-status lead-status--${lead.status.toLowerCase()}`}>{lead.status}</span></div><footer><div>{lead.likes !== null && <span><Heart size={14} /> {lead.likes}</span>}{lead.replies !== null && <span><MessageCircle size={14} /> {lead.replies}</span>}{!hasEngagement && <span title="Threads tidak mengirim metrik untuk postingan ini">Metrik tidak tersedia</span>}<span><MapPin size={14} /> {lead.location}</span></div><Link className="button button--primary button--small" href={`/dashboard/leads/${lead.id}`}>Kelola balasan</Link></footer></article>;
}
