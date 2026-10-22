import Link from "next/link";
import { Check, Heart, MapPin, MessageCircle } from "lucide-react";
import { LEAD_INTENT_LABEL } from "@/lib/lead-intent";
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

/** Satu baris konteks percakapan: balasan atas siapa, atau bagian utas. */
export function leadThreadContext(lead: Pick<Lead, "isReply" | "replyToHandle" | "threadSize">) {
  if (lead.isReply) return lead.replyToHandle ? `Balasan untuk @${lead.replyToHandle}` : "Balasan dalam percakapan";
  if ((lead.threadSize ?? 0) > 1) return `Bagian dari utas ${lead.threadSize} postingan`;
  return "Postingan utas pembuka";
}

export function LeadCard({ lead, compact = false, onMarkRead }: {
  lead: Lead;
  compact?: boolean;
  /** Diberikan hanya di feed; panel ringkas tidak menandai baca. */
  onMarkRead?: (leadId: string) => void;
}) {
  // Metrik hanya ditampilkan bila Threads benar-benar mengirimkannya.
  const hasEngagement = lead.likes !== null || lead.replies !== null;
  const unread = lead.viewedAt === null;
  return <article className={`lead-card ${compact ? "lead-card--compact" : ""} ${unread ? "lead-card--unread" : ""}`.trim()}>
    <header>
      <span className="lead-avatar">{lead.avatar}</span>
      <div><strong>{lead.author}</strong><span>{lead.handle} · {lead.time} · {leadThreadContext(lead)}</span></div>
      {unread && <span className="lead-unread" title="Belum dibaca">Belum dibaca</span>}
    </header>
    <p>{lead.text}</p>
    <div className="lead-tags">
      {/* Vonis AI menggantikan angka ketika ada: "88% cocok" adalah skor
          kemiripan kata, sedangkan yang ingin diketahui pemilik bisnis adalah
          apakah orang ini calon pelanggannya. Angka tetap ditampilkan sebagai
          cadangan ketika AI belum menilai. */}
      {lead.aiVerdict === "MATCH" && <span className="match-chip match-chip--yes" title={lead.aiReason ?? undefined}>Cocok</span>}
      {lead.aiVerdict === "NO_MATCH" && <span className="match-chip match-chip--no" title={lead.aiReason ?? undefined}>Tidak cocok</span>}
      {lead.aiVerdict === "UNSURE" && <span className="match-chip match-chip--maybe" title={lead.aiReason ?? undefined}>Belum pasti</span>}
      {!lead.aiVerdict && <span className="score-chip">{lead.score}% cocok</span>}
      <span className={`intent-chip intent-chip--${lead.intent.replace(" ", "-")}`}>{LEAD_INTENT_LABEL[lead.intent]}</span>
      <span className="keyword-chip">“{lead.keyword}”</span>
      <span className={`lead-status lead-status--${lead.status.toLowerCase()}`}>{lead.status}</span>
    </div>
    <footer>
      <div>
        {lead.likes !== null && <span><Heart size={14} /> {lead.likes}</span>}
        {lead.replies !== null && <span><MessageCircle size={14} /> {lead.replies}</span>}
        {!hasEngagement && <span title="Threads tidak mengirim metrik untuk postingan ini">Metrik tidak tersedia</span>}
        <span><MapPin size={14} /> {lead.location}</span>
      </div>
      <div className="lead-card__actions">
        {unread && onMarkRead && <button className="button button--ghost button--small" type="button" onClick={() => onMarkRead(lead.id)}>
          <Check size={14} /> Tandai sudah dibaca
        </button>}
        <Link className="button button--primary button--small" href={`/dashboard/leads/${lead.id}`}>Kelola balasan</Link>
      </div>
    </footer>
  </article>;
}
