"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { LeadCard } from "@/components/dashboard-ui";
import type { Lead } from "@/lib/workspace-data";

type ApiResponse = { data?: Lead[]; error?: string; code?: string; meta?: { resultCount: number } };

export function LeadFeed() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Semua");
  const [sort, setSort] = useState("relevansi");
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    fetch("/api/threads/search", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json() as ApiResponse;
        if (!response.ok) throw new Error(payload.error ?? "Lead belum dapat dimuat.");
        if (active) setItems(payload.data ?? []);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : "Lead belum dapat dimuat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function searchThreads(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/threads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const payload = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(payload.error ?? "Pencarian Threads gagal.");
      setItems(payload.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pencarian Threads gagal.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => items
    .filter(lead => status === "Semua" || lead.status === status)
    .sort((a, b) => sort === "relevansi" ? b.score - a.score : b.time.localeCompare(a.time)), [items, status, sort]);

  return <>
    <form className="filter-bar threads-search-bar" onSubmit={searchThreads}>
      <label className="filter-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari kata kunci di Threads" aria-label="Cari lead di Threads" /></label>
      <button className="button button--primary button--small" type="submit" disabled={loading || query.trim().length < 2}>{loading ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />} Cari Threads</button>
      <div className="filter-tabs" aria-label="Filter status">{["Semua", "Baru", "Tersimpan", "Dibalas"].map(item => <button type="button" className={status === item ? "active" : ""} key={item} onClick={() => setStatus(item)}>{item}</button>)}</div>
    </form>
    {error && <div className="inline-error" role="alert"><strong>Pencarian belum dapat dijalankan.</strong><span>{error}</span></div>}
    <div className="result-summary"><span><strong>{filtered.length}</strong> lead ditemukan</span><label>Urutkan <select value={sort} onChange={event => setSort(event.target.value)}><option value="relevansi">Paling relevan</option><option value="terbaru">Terbaru</option></select></label></div>
    <div className="lead-list">{filtered.map(lead => <LeadCard key={lead.id} lead={lead} />)}{!loading && filtered.length === 0 && <div className="empty-state"><Search /><h2>Belum ada lead</h2><p>Hubungkan Threads, lalu cari kata kunci pertama Anda.</p></div>}</div>
  </>;
}
