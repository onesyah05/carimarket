"use client";

import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle, Plus, Search, Trash2 } from "lucide-react";

type Item = { id: string; label: string; negative: boolean; matches: number; active: boolean };
type ApiResponse = { data?: Item | Item[]; error?: string };

export function KeywordManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [negative, setNegative] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    fetch("/api/keywords", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json() as ApiResponse;
        if (!response.ok) throw new Error(payload.error ?? "Kata kunci belum dapat dimuat.");
        if (active) setItems(Array.isArray(payload.data) ? payload.data : []);
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Kata kunci belum dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    const phrase = value.trim();
    if (phrase.length < 2) return;
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phrase, negative }) });
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.data || Array.isArray(payload.data)) throw new Error(payload.error ?? "Kata kunci belum dapat ditambahkan.");
      const created = payload.data as Item;
      setItems(current => [created, ...current.filter(item => item.id !== created.id)]);
      setValue("");
      setNegative(false);
      setAdding(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kata kunci belum dapat ditambahkan.");
    } finally {
      setLoading(false);
    }
  }

  async function setActive(item: Item, active: boolean) {
    const previous = items;
    setItems(current => current.map(keyword => keyword.id === item.id ? { ...keyword, active } : keyword));
    const response = await fetch("/api/keywords", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, active }) });
    if (!response.ok) {
      const payload = await response.json() as ApiResponse;
      setItems(previous);
      setError(payload.error ?? "Status kata kunci belum dapat diubah.");
    }
  }

  async function remove(item: Item) {
    const response = await fetch("/api/keywords", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    if (response.ok) setItems(current => current.filter(keyword => keyword.id !== item.id));
    else {
      const payload = await response.json() as ApiResponse;
      setError(payload.error ?? "Kata kunci belum dapat dihapus.");
    }
  }

  return <>
    <div className="keyword-actions"><button className="button button--primary" onClick={() => setAdding(current => !current)}><Plus size={16} /> Tambah kata kunci</button></div>
    {adding && <form className="inline-add" onSubmit={add}><label htmlFor="new-keyword">Kata kunci baru</label><input className="input" id="new-keyword" value={value} onChange={event => setValue(event.target.value)} placeholder={negative ? "Contoh: lowongan" : "Contoh: foto properti"} autoFocus /><label className="sr-only" htmlFor="new-keyword-kind">Jenis kata kunci</label><select className="input" id="new-keyword-kind" value={negative ? "exclude" : "include"} onChange={event => setNegative(event.target.value === "exclude")}><option value="include">Pencarian</option><option value="exclude">Eksklusi</option></select><button className="button button--primary" type="submit" disabled={loading || value.trim().length < 2}>Tambahkan</button><button className="button button--ghost" type="button" onClick={() => setAdding(false)}>Batal</button></form>}
    {error && <div className="inline-error" role="alert"><strong>Kata kunci belum dapat diproses.</strong><span>{error}</span></div>}
    <div className="keyword-summary"><div>{loading ? <LoaderCircle className="spin" /> : <Search />}<span><strong>{items.filter(item => item.active).length}</strong> kata kunci aktif</span></div></div>
    <section className="panel table-panel"><div className="panel-heading"><div><h2>Daftar kata kunci</h2><p>Istilah pencarian menemukan lead; istilah eksklusi menyaring postingan yang memuatnya sebelum masuk ke feed.</p></div></div><div className="data-table keyword-table"><div className="data-row data-head"><span>Kata kunci</span><span>Jenis</span><span>Kecocokan</span><span>Status</span><span>Aksi</span></div>{items.map(keyword => <div className="data-row" key={keyword.id}><strong data-label="Kata kunci">{keyword.label}</strong><span data-label="Jenis"><em className={keyword.negative ? "tag-negative" : "tag-positive"}>{keyword.negative ? "Eksklusi" : "Pencarian"}</em></span><span data-label="Kecocokan">{keyword.matches} hasil</span><label className="switch-label" data-label="Status"><input type="checkbox" checked={keyword.active} onChange={event => void setActive(keyword, event.target.checked)} /> {keyword.active ? "Aktif" : "Jeda"}</label><div className="keyword-row-action" data-label="Aksi"><button className="icon-button" aria-label={`Hapus ${keyword.label}`} onClick={() => void remove(keyword)}><Trash2 size={17} /></button></div></div>)}{!loading && items.length === 0 && <div className="empty-state"><Search /><h2>Belum ada kata kunci</h2><p>Tambahkan istilah pertama untuk mulai mencari lead.</p></div>}</div></section>
  </>;
}
