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

/**
 * Cincin relevansi.
 *
 * DESIGN.md menetapkan lingkaran logo sebagai "progress ring, focus marker,
 * dan indikator relevansi", tetapi motif itu belum pernah dipakai di mana pun.
 * Di sinilah tempatnya: skor kecocokan adalah satu-satunya angka yang benar
 * benar dihitung produk ini, dan sebelumnya ia hanya menjadi chip "Cocok"
 * atau tidak muncul sama sekali.
 *
 * Warnanya membawa arti, bukan hiasan: aksen hanya untuk lead yang melewati
 * ambang kirim, sisanya netral. Jadi satu layar penuh kartu tetap tenang dan
 * yang layak dibuka langsung terlihat.
 */
function LeadScoreRing({ score, strong }: { score: number; strong: boolean }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  // r dipilih agar keliling mendekati 100, sehingga dasharray dapat memakai
  // nilai skor apa adanya tanpa perhitungan tambahan saat render.
  const radius = 15.9155;
  return (
    <span className={`lead-ring ${strong ? "lead-ring--strong" : ""}`.trim()} title={`Skor kecocokan ${clamped} dari 100`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="lead-ring__track" cx="18" cy="18" r={radius} />
        <circle className="lead-ring__value" cx="18" cy="18" r={radius} strokeDasharray={`${clamped} 100`} />
      </svg>
      <b>{clamped}</b>
    </span>
  );
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

  /**
   * Membuka postingannya di Threads sekaligus menandainya sudah dibaca.
   *
   * Sebuah <a> betulan, bukan onClick pada <article>: menengah-klik dan
   * ctrl-klik tetap bekerja, alamatnya terlihat di bilah status, dan pembaca
   * layar menyebutnya sebagai tautan. Menandai baca dilakukan di sini karena
   * membuka postingannya memang berarti sudah dibaca — tombol "Tandai sudah
   * dibaca" tinggal untuk yang memutuskan tanpa membuka.
   */
  const openInThreads = () => { if (unread) onMarkRead?.(lead.id); };
  // Alasan AI dulu hanya hidup di atribut title, jadi tidak pernah terbaca
  // tanpa mengarahkan tetikus. Itu satu kalimat yang menjelaskan kenapa
  // skornya begitu, dan justru itu yang dicari orang sebelum membuka lead.
  const reason = lead.aiReason ?? lead.matchReason ?? null;
  const body = <>
    <header>
      <span className="lead-avatar">{lead.avatar}</span>
      <div>
        <strong>{unread && <i className="lead-dot" title="Belum dibaca" />}{lead.author}</strong>
        <span>{lead.handle} · {lead.time} · {leadThreadContext(lead)}</span>
      </div>
      <LeadScoreRing score={lead.score} strong={lead.matched !== false && lead.aiVerdict !== "NO_MATCH"} />
    </header>
    <p>{lead.text}</p>
    {reason && <p className="lead-reason">{reason}</p>}
  </>;

  return <article className={`lead-card ${compact ? "lead-card--compact" : ""} ${unread ? "lead-card--unread" : ""}`.trim()}>
    {lead.permalink
      ? <a className="lead-card__open" href={lead.permalink} target="_blank" rel="noreferrer" onClick={openInThreads} title="Buka postingan ini di Threads">{body}</a>
      : body}
    {/* Chip kecocokan dan chip skor dua duanya hilang: keduanya mengatakan
        hal yang kini dikatakan cincin, dan sebelumnya chip "Cocok" berdiri
        tepat di sebelah chip niat dengan hijau yang nyaris sama, sehingga
        tidak ada yang menonjol. Yang tersisa adalah tiga keterangan yang
        masing masing menjawab pertanyaan berbeda: niat penulisnya, kata kunci
        yang menemukannya, dan posisinya dalam alur kerja. */}
    <div className="lead-tags">
      <span className={`intent-chip intent-chip--${lead.intent.replace(" ", "-")}`}>{LEAD_INTENT_LABEL[lead.intent]}</span>
      <span className="keyword-chip">{lead.keyword}</span>
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
