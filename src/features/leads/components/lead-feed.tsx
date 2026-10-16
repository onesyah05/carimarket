"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCheck, LoaderCircle, Search, Tags } from "lucide-react";
import { LeadCard } from "@/components/dashboard-ui";
import { suggestionMeta, type KeywordSuggestion } from "@/lib/keyword-suggestions";
import { LEAD_INTENT_LABEL, type LeadIntent } from "@/lib/lead-intent";
import type { Lead } from "@/lib/workspace-data";

type SearchMeta = {
  ran?: number;
  total?: number;
  resultCount?: number;
  excludedCount?: number;
  createdCount?: number;
  stopped?: string | null;
  suggestions?: KeywordSuggestion[];
};
type ApiResponse = { data?: Lead[]; error?: string; code?: string; meta?: SearchMeta };

const intentFilters: Array<{ label: string; value: LeadIntent | "semua" }> = [
  { label: "Semua postingan", value: "semua" },
  { label: LEAD_INTENT_LABEL.mencari, value: "mencari" },
  { label: LEAD_INTENT_LABEL.menawarkan, value: "menawarkan" },
  { label: LEAD_INTENT_LABEL["tidak jelas"], value: "tidak jelas" },
];

const engagementFilters = [
  { label: "Semua engagement", value: 0 },
  { label: "Min. 10 interaksi", value: 10 },
  { label: "Min. 50 interaksi", value: 50 },
];

/**
 * Feed lead beserta satu tombol untuk menjalankan semua kata kunci.
 *
 * Sebelumnya di sini ada kotak ketik "Cari kata kunci di Threads". Bentuknya
 * menjanjikan pencarian bebas, padahal setiap frasa yang diketik diam-diam
 * menjadi kata kunci baru yang memakan jatah paket. Sekarang satu tombol
 * menjalankan kata kunci yang memang sudah disusun pengguna, dan penyusunan
 * kata kunci sepenuhnya menjadi urusan halaman Kata kunci.
 */
export function LeadFeed() {
  const [status, setStatus] = useState("Semua");
  // Bawaannya "semua": menyaring sejak awal akan menyembunyikan sebagian besar
  // feed tanpa diminta. Chip di tiap kartu sudah cukup untuk membedakan, dan
  // saringannya satu klik ketika memang hanya permintaan yang dicari.
  const [intent, setIntent] = useState<LeadIntent | "semua">("semua");
  const [sort, setSort] = useState("relevansi");
  const [minEngagement, setMinEngagement] = useState(0);
  const [items, setItems] = useState<Lead[]>([]);
  const [keywords, setKeywords] = useState<KeywordSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const [lastRun, setLastRun] = useState<SearchMeta>();

  useEffect(() => {
    let active = true;
    fetch("/api/threads/search", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json() as ApiResponse;
        if (!response.ok) throw new Error(payload.error ?? "Lead belum dapat dimuat.");
        if (!active) return;
        setItems(payload.data ?? []);
        setKeywords(payload.meta?.suggestions ?? []);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : "Lead belum dapat dimuat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function searchNow() {
    setSearching(true);
    setError(undefined);
    setLastRun(undefined);
    try {
      const response = await fetch("/api/threads/search", { method: "POST" });
      const payload = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(payload.error ?? "Pencarian Threads gagal.");
      setItems(payload.data ?? []);
      setKeywords(payload.meta?.suggestions ?? keywords);
      setLastRun(payload.meta);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pencarian Threads gagal.");
    } finally {
      setSearching(false);
    }
  }

  const active = keywords.filter(keyword => keyword.active);
  const unread = items.filter(lead => lead.viewedAt === null).length;

  async function markRead(leadId: string) {
    setItems(current => current.map(lead => lead.id === leadId ? { ...lead, viewedAt: new Date().toISOString() } : lead));
    const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/dibaca`, { method: "POST" });
    if (!response.ok) setError("Penandaan baca belum tersimpan. Muat ulang halaman untuk melihat status terbaru.");
  }

  async function markAllRead() {
    const stamp = new Date().toISOString();
    setItems(current => current.map(lead => lead.viewedAt === null ? { ...lead, viewedAt: stamp } : lead));
    const response = await fetch("/api/leads/dibaca", { method: "POST" });
    if (!response.ok) setError("Penandaan baca belum tersimpan. Muat ulang halaman untuk melihat status terbaru.");
  }
  const filtered = useMemo(() => items
    .filter(lead => status === "Semua" || lead.status === status)
    .filter(lead => intent === "semua" || lead.intent === intent)
    // Lead tanpa metrik tidak dapat dibandingkan, jadi hanya disaring saat
    // pengguna benar-benar meminta ambang engagement.
    .filter(lead => minEngagement === 0 || (lead.likes ?? 0) + (lead.replies ?? 0) >= minEngagement)
    .sort((a, b) => sort === "relevansi"
      ? b.score - a.score
      : new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()), [items, status, intent, sort, minEngagement]);

  return <>
    <section className="panel lead-search">
      <div className="lead-search__main">
        <div>
          <h2>Cari leads sekarang</h2>
          <p>{active.length > 0
            ? `Menjalankan ${active.length} kata kunci aktif sekaligus dan menarik percakapan Threads terbaru untuk masing-masing.`
            : "Belum ada kata kunci aktif. Tambahkan kata kunci dulu agar pencarian punya sesuatu untuk dicari."}</p>
        </div>
        <button className="button button--primary lead-search__button" type="button" onClick={() => void searchNow()} disabled={searching || active.length === 0}>
          {searching ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
          {searching ? "Mencari…" : "Cari leads sekarang"}
        </button>
      </div>

      <div className="lead-search__keywords">
        <span className="lead-search__label"><Tags size={14} /> Kata kunci yang dijalankan</span>
        {active.length > 0
          ? <ul>{active.map(keyword => <li key={keyword.phrase}><strong>{keyword.phrase}</strong><small>{suggestionMeta(keyword)}</small></li>)}</ul>
          : <p className="lead-search__empty">Belum ada kata kunci aktif.</p>}
        <Link className="text-link" href="/dashboard/kata-kunci">Kelola kata kunci</Link>
      </div>

      {lastRun && <p className="lead-search__summary" role="status">
        {lastRun.ran ?? 0} dari {lastRun.total ?? 0} kata kunci dijalankan · {lastRun.resultCount ?? 0} postingan cocok
        {(lastRun.createdCount ?? 0) > 0 ? ` · ${lastRun.createdCount} lead baru` : " · tidak ada lead baru"}
        {(lastRun.excludedCount ?? 0) > 0 ? ` · ${lastRun.excludedCount} disaring kata eksklusi` : ""}
      </p>}
      {lastRun?.stopped && <p className="form-feedback form-feedback--error" role="alert">{lastRun.stopped}</p>}
    </section>

    {error && <div className="inline-error" role="alert"><strong>Pencarian belum dapat dijalankan.</strong><span>{error}</span></div>}

    <div className="filter-bar lead-filters">
      <div className="filter-tabs" aria-label="Filter niat postingan">{intentFilters.map(item => <button type="button" className={intent === item.value ? "active" : ""} key={item.value} onClick={() => setIntent(item.value)}>{item.label}</button>)}</div>
      <div className="filter-tabs" aria-label="Filter status">{["Semua", "Baru", "Tersimpan", "Dibalas"].map(item => <button type="button" className={status === item ? "active" : ""} key={item} onClick={() => setStatus(item)}>{item}</button>)}</div>
    </div>

    <div className="result-summary">
      <span><strong>{filtered.length}</strong> lead ditemukan{unread > 0 ? ` · ${unread} belum dibaca` : ""}</span>
      {unread > 0 && <button type="button" onClick={() => void markAllRead()}><CheckCheck size={15} /> Tandai semua sudah dibaca</button>}
      <label>Engagement <select value={minEngagement} onChange={event => setMinEngagement(Number(event.target.value))} aria-label="Filter engagement minimum">{engagementFilters.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
      <label>Urutkan <select value={sort} onChange={event => setSort(event.target.value)}><option value="relevansi">Paling relevan</option><option value="terbaru">Terbaru</option></select></label>
    </div>

    <div className="lead-list">
      {filtered.map(lead => <LeadCard key={lead.id} lead={lead} onMarkRead={id => void markRead(id)} />)}
      {!loading && filtered.length === 0 && <div className="empty-state">
        <Search />
        <h2>{items.length > 0 ? "Tidak ada lead pada saringan ini" : lastRun ? "Tidak ada lead yang cocok" : "Belum ada lead"}</h2>
        <p>{items.length > 0
          ? `Saringan “${intentFilters.find(item => item.value === intent)?.label}” menyembunyikan ${items.length} lead lain. Pilih “Semua postingan” untuk melihat semuanya.`
          : lastRun
            ? "Pencarian selesai, tetapi tidak ada postingan baru yang cocok. Coba lagi nanti atau sesuaikan kata kunci Anda."
            : "Tekan “Cari leads sekarang” untuk menjalankan kata kunci Anda dan menarik percakapan Threads terbaru."}</p>
      </div>}
    </div>
  </>;
}
