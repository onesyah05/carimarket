"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Clock3, Edit3, ShieldCheck } from "lucide-react";
import type { Lead } from "@/lib/workspace-data";
import { useReplyAutomation } from "@/features/replies/lib/use-reply-automation";

export function ReplyQueue() {
  const { settings } = useReplyAutomation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/threads/search", { cache: "no-store" })
      .then(async response => response.ok ? (await response.json() as { data?: Lead[] }).data ?? [] : [])
      .then(items => { if (active) setLeads(items); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const automatic = settings.mode === "auto";
  return <><div className={`queue-mode-banner queue-mode-banner--${settings.mode}`}><span>{automatic ? <Bot /> : <Edit3 />}</span><div><strong>{automatic ? "Balas otomatis aktif" : "Tinjau dulu aktif"}</strong><p>{automatic ? `Lead dengan skor minimal ${settings.minimumScore}% mengikuti aturan otomatis. Sisanya menunggu tinjauan.` : "Semua draft menunggu persetujuan Anda sebelum dikirim."}</p></div><Link href="/dashboard/pengaturan">Ubah mode</Link></div><div className="reply-queue">{leads.slice(0, 3).map(lead => { const flagged = Boolean(lead.flagged); const eligible = automatic && lead.score >= settings.minimumScore && !flagged; return <article className="queue-card" key={lead.id}><div className={`queue-icon ${eligible ? "queue-icon--auto" : ""}`}>{eligible ? <Bot size={18} /> : <Edit3 size={18} />}</div><div className="queue-main"><div className="queue-main__heading"><strong>Draft untuk {lead.author}</strong><span><Clock3 size={13} /> Ditemukan {lead.time}</span></div><p>Siapkan balasan yang relevan untuk kebutuhan {lead.keyword} dari {lead.author}.</p><div className="queue-main__badges"><span className="score-chip">{lead.score}% cocok</span>{eligible ? <span className="auto-chip">Lolos aturan otomatis</span> : <span className="flag-chip"><ShieldCheck size={12} /> {flagged ? "Perlu cek klaim" : "Perlu ditinjau"}</span>}</div></div><Link className={`button ${eligible ? "button--primary" : "button--ghost"} button--small`} href={`/dashboard/leads/${lead.id}`}>{eligible ? "Buka draft" : "Tinjau"}</Link></article>; })}{!loading && leads.length === 0 && <div className="empty-state"><h2>Belum ada lead untuk dibalas</h2><p>Cari percakapan publik terlebih dahulu dari halaman Lead.</p><Link className="button button--primary button--small" href="/dashboard/leads">Cari lead</Link></div>}</div></>;
}
