"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, Lock, LoaderCircle, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { checkKeywordCategory } from "@/lib/keyword-categories";
import { lockRemainingLabel } from "@/lib/keyword-lock";

type Item = {
  id: string;
  label: string;
  negative: boolean;
  matches: number;
  active: boolean;
  createdAt: string;
  locked: boolean;
  unlockAt: string;
};
type Meta = {
  keywordLimit: number | null;
  planName: string | null;
  searchIntervalHours: number | null;
  category: string;
  suggestions: string[];
};
type ApiResponse = { data?: Item | Item[]; error?: string; meta?: Meta };

const EMPTY_META: Meta = { keywordLimit: null, planName: null, searchIntervalHours: null, category: "", suggestions: [] };

/**
 * Pengelolaan kata kunci.
 *
 * Dipisah menjadi dua kolom karena keduanya memang dua pekerjaan berbeda:
 * istilah pencarian menemukan lead, istilah eksklusi membuangnya. Satu tabel
 * campur dengan kolom "jenis" memaksa pembaca memilah sendiri apa yang sudah
 * jelas berbeda. Istilahnya kini sama persis dengan yang dipakai onboarding:
 * pencarian dan eksklusi.
 */
export function KeywordManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState<Meta>(EMPTY_META);
  const [drafts, setDrafts] = useState({ include: "", exclude: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    fetch("/api/keywords", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json() as ApiResponse;
        if (!response.ok) throw new Error(payload.error ?? "Kata kunci belum dapat dimuat.");
        if (!active) return;
        setItems(Array.isArray(payload.data) ? payload.data : []);
        if (payload.meta) setMeta(payload.meta);
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Kata kunci belum dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const limit = meta.keywordLimit;
  const full = limit !== null && items.length >= limit;
  const positives = items.filter(item => !item.negative);
  const negatives = items.filter(item => item.negative);

  async function add(phrase: string, negative: boolean) {
    const next = phrase.trim();
    if (next.length < 2) return;
    if (!negative) {
      const verdict = checkKeywordCategory(next, meta.category);
      if (!verdict.ok) {
        setError(verdict.message);
        return;
      }
    }
    setBusy(negative ? "exclude" : "include");
    setError(undefined);
    try {
      const response = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: next, negative }),
      });
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.data || Array.isArray(payload.data)) throw new Error(payload.error ?? "Kata kunci belum dapat ditambahkan.");
      const created = payload.data;
      setItems(current => [created, ...current.filter(item => item.id !== created.id)]);
      setDrafts(current => ({ ...current, [negative ? "exclude" : "include"]: "" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kata kunci belum dapat ditambahkan.");
    } finally {
      setBusy(null);
    }
  }

  async function setActive(item: Item, active: boolean) {
    const previous = items;
    setItems(current => current.map(keyword => keyword.id === item.id ? { ...keyword, active } : keyword));
    const response = await fetch("/api/keywords", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, active }),
    });
    if (!response.ok) {
      const payload = await response.json() as ApiResponse;
      setItems(previous);
      setError(payload.error ?? "Status kata kunci belum dapat diubah.");
    }
  }

  async function remove(item: Item) {
    setBusy(item.id);
    setError(undefined);
    const response = await fetch("/api/keywords", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    if (response.ok) setItems(current => current.filter(keyword => keyword.id !== item.id));
    else {
      const payload = await response.json() as ApiResponse;
      setError(payload.error ?? "Kata kunci belum dapat dihapus.");
    }
    setBusy(null);
  }

  function column(negative: boolean) {
    const key = negative ? "exclude" : "include";
    const list = negative ? negatives : positives;
    const unused = meta.suggestions.filter(item => !items.some(keyword => keyword.label.toLowerCase() === item.toLowerCase()));

    return (
      <section className="panel keyword-column">
        <header>
          <span className={`keyword-column__icon keyword-column__icon--${negative ? "exclude" : "find"}`}>
            {negative ? <SlidersHorizontal size={15} /> : <Search size={15} />}
          </span>
          <div>
            <h2>Kata kunci {negative ? "eksklusi" : "pencarian"}</h2>
            <p>{negative
              ? "Postingan yang memuat istilah ini dibuang sebelum masuk ke feed lead."
              : `Istilah yang dicari pelanggan. Dijalankan ulang tiap ${meta.searchIntervalHours ?? 24} jam sesuai paket${meta.planName ? ` ${meta.planName}` : ""}.`}</p>
          </div>
          <span className="keyword-column__count">{list.length}</span>
        </header>

        <form className="input-action" onSubmit={(event: FormEvent) => { event.preventDefault(); void add(drafts[key], negative); }}>
          <input
            className="input"
            value={drafts[key]}
            onChange={event => setDrafts(current => ({ ...current, [key]: event.target.value }))}
            placeholder={negative ? "Contoh: lowongan" : `Contoh: ${meta.suggestions[0] ?? "jasa yang Anda tawarkan"}`}
            maxLength={120}
            disabled={full || busy !== null}
            aria-label={`Tambah kata kunci ${negative ? "eksklusi" : "pencarian"}`}
          />
          <button type="submit" aria-label={`Tambah kata kunci ${negative ? "eksklusi" : "pencarian"}`} disabled={full || busy !== null || drafts[key].trim().length < 2}>
            {busy === key ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}
          </button>
        </form>

        {list.length === 0 && !loading && <p className="keyword-column__empty">
          {negative ? "Belum ada istilah eksklusi. Boleh dikosongkan." : "Belum ada istilah pencarian."}
        </p>}

        <ul className="keyword-rows">
          {list.map(keyword => (
            <li key={keyword.id}>
              <div>
                <strong>{keyword.label}</strong>
                <small>{keyword.matches} hasil{keyword.locked ? ` · terkunci ${lockRemainingLabel(keyword.createdAt)}` : ""}</small>
              </div>
              <label className="switch-label">
                <input type="checkbox" checked={keyword.active} onChange={event => void setActive(keyword, event.target.checked)} />
                {keyword.active ? "Aktif" : "Jeda"}
              </label>
              <button
                className="icon-button"
                type="button"
                aria-label={keyword.locked ? `${keyword.label} terkunci ${lockRemainingLabel(keyword.createdAt)}` : `Hapus ${keyword.label}`}
                title={keyword.locked ? `Kata kunci baru terkunci 24 jam. Dapat dihapus ${lockRemainingLabel(keyword.createdAt)}.` : "Hapus"}
                disabled={keyword.locked || busy !== null}
                onClick={() => void remove(keyword)}
              >
                {keyword.locked ? <Lock size={16} /> : <Trash2 size={17} />}
              </button>
            </li>
          ))}
        </ul>

        {!negative && unused.length > 0 && !full && <div className="keyword-suggest-chips">
          <span><Lightbulb size={13} /> Saran untuk {meta.category}</span>
          <div>{unused.map(suggestion => (
            <button key={suggestion} type="button" disabled={busy !== null} onClick={() => void add(suggestion, false)}>+ {suggestion}</button>
          ))}</div>
        </div>}
      </section>
    );
  }

  return <>
    <div className="keyword-setup__meter">
      <span>
        {loading ? <LoaderCircle className="spin" size={15} /> : null}
        <strong>{items.length}{limit === null ? "" : ` dari ${limit}`}</strong> kata kunci terpakai{meta.planName ? ` pada paket ${meta.planName}` : ""}
        {meta.category ? ` · kategori ${meta.category}` : ""}
      </span>
      <span className="keyword-setup__split">{positives.length} pencarian · {negatives.length} eksklusi · {items.filter(item => item.active).length} aktif</span>
    </div>
    {limit !== null && <div className="keyword-setup__bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (items.length / limit) * 100)}%` }} /></div>}
    {full && <p className="keyword-setup__full">Batas paket tercapai. <Link className="text-link" href="/harga">Lihat paket lain</Link> atau hapus kata kunci yang sudah tidak dipakai.</p>}

    {error && <div className="inline-error" role="alert"><strong>Kata kunci belum dapat diproses.</strong><span>{error}</span></div>}

    <div className="keyword-setup__columns">
      {column(false)}
      {column(true)}
    </div>
  </>;
}
