"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LeadCard } from "@/components/dashboard-ui";
import type { Lead } from "@/lib/workspace-data";

type ThreadsStatus = {
  configured: boolean;
  requiresHttps?: boolean;
  credentialsInvalid?: boolean;
  connected: boolean;
  searchPreviewAvailable?: boolean;
  username?: string | null;
  publishingLimit?: {
    quotaUsage: number;
    quotaLimit: number;
    replyQuotaUsage: number;
    replyQuotaLimit: number;
  } | null;
};

export function DashboardDataPanels() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/threads/search", { cache: "no-store" }).then(async response => response.ok ? (await response.json() as { data?: Lead[] }).data ?? [] : []).then(nextLeads => {
      if (!active) return;
      setLeads(nextLeads);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const pending = leads.filter(lead => lead.status === "Baru");
  const preview = [...pending].sort((a, b) => b.score - a.score).slice(0, 3);
  return <div className="panel panel--leads">
      <div className="panel-heading"><div><h2>Lead prioritas</h2><p>{loading ? "Memuat lead..." : pending.length > 0 ? `${preview.length} dari ${pending.length} lead baru dengan skor tertinggi.` : "Belum ada lead baru."}</p></div><Link href="/dashboard/leads">Lihat semua lead</Link></div>
      <div className="compact-leads">{preview.map(lead => <LeadCard key={lead.id} lead={lead} compact />)}{!loading && pending.length === 0 && <div className="empty-state empty-state--compact"><h2>Belum ada lead tersimpan</h2><p>Cari percakapan publik dari halaman Lead.</p></div>}</div>
    </div>;
}

export function ThreadsStatusCard() {
  const [status, setStatus] = useState<ThreadsStatus>({ configured: false, connected: false });
  useEffect(() => {
    let active = true;
    fetch("/api/integrations/threads/status", { cache: "no-store" })
      .then(async response => response.ok ? (await response.json() as { data?: ThreadsStatus }).data ?? { configured: false, connected: false } : { configured: false, connected: false })
      .then(next => { if (active) setStatus(next); });
    return () => { active = false; };
  }, []);
  const statusCopy = status.connected
    ? `Terhubung ke @${status.username ?? "threads"}. Fitur tersedia sesuai izin akun dan status App Review.`
    : status.searchPreviewAvailable
      ? "Pencarian publik tersedia dalam mode pratinjau pra-App Review. Hubungkan akun Threads untuk mengirim balasan."
      : status.configured
        ? "Hubungkan akun Threads untuk mulai mencari dan membalas."
        : status.credentialsInvalid
          ? "Konfigurasi Threads ditolak Meta. Administrator perlu memperbarui Threads App Secret."
        : status.requiresHttps
          ? "Buka Cari Market melalui alamat HTTPS untuk menghubungkan akun Threads."
        : "Koneksi Threads belum tersedia. Silakan hubungi administrator workspace.";
  const replyQuota = status.publishingLimit
    ? Math.max(0, status.publishingLimit.replyQuotaLimit - status.publishingLimit.replyQuotaUsage)
    : null;
  return <section className="panel search-status"><h2>Status Threads</h2><p><strong>{status.connected ? "Integrasi aktif." : "Integrasi belum aktif."}</strong> {statusCopy}</p>
    {status.connected && replyQuota !== null && <p className="search-status__quota">Sisa kuota balasan Threads hari ini: <strong>{replyQuota}</strong> dari {status.publishingLimit?.replyQuotaLimit}.</p>}
    <Link href="/dashboard/pengaturan">Periksa integrasi</Link></section>;
}
