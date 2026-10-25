"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { checkKeywordCategory } from "@/lib/keyword-categories";

type Draft = { phrase: string; negative: boolean };
type Meta = { keywordLimit: number | null; planName: string | null; category: string; suggestions: string[] };

/**
 * Langkah kata kunci pada onboarding.
 *
 * Dua kolom sejajar supaya hubungan keduanya terbaca sekaligus: kolom kiri
 * menemukan lead, kolom kanan membuangnya. Jatah paket ditampilkan sejak awal,
 * karena sebelumnya pengguna baru tahu batasnya setelah tombol simpan ditolak.
 *
 * Saran diambil dari kategori bisnis yang dipilih di langkah pertama, dan
 * frasa yang jelas milik bidang lain ditolak di sini maupun di server.
 */
export function KeywordStep() {
  const router = useRouter();
  const [items, setItems] = useState<Draft[]>([]);
  const [meta, setMeta] = useState<Meta>({ keywordLimit: null, planName: null, category: "", suggestions: [] });
  const [value, setValue] = useState("");
  const [excludeValue, setExcludeValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    fetch("/api/keywords", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json() as { meta?: Meta; data?: Array<{ label: string; negative: boolean }> };
        if (!active || !response.ok) return;
        if (payload.meta) setMeta(payload.meta);
        // Pengguna bisa kembali ke langkah ini; kata kunci yang sudah
        // tersimpan ikut ditampilkan agar tidak terasa hilang.
        if (payload.data?.length) setItems(payload.data.map(item => ({ phrase: item.label, negative: item.negative })));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const positives = items.filter(item => !item.negative);
  const negatives = items.filter(item => item.negative);
  const limit = meta.keywordLimit;
  const full = limit !== null && items.length >= limit;

  function add(phrase: string, negative: boolean) {
    const next = phrase.trim();
    if (next.length < 2) return false;
    if (items.some(item => item.phrase.toLowerCase() === next.toLowerCase() && item.negative === negative)) {
      setError(`“${next}” sudah ada di daftar.`);
      return false;
    }
    if (limit !== null && items.length >= limit) {
      setError(`Paket ${meta.planName ?? "Anda"} hanya mengizinkan ${limit} kata kunci. Hapus salah satu atau naikkan paket.`);
      return false;
    }
    if (!negative) {
      const verdict = checkKeywordCategory(next, meta.category);
      if (!verdict.ok) {
        setError(verdict.message);
        return false;
      }
    }
    setError(undefined);
    setItems(current => [...current, { phrase: next, negative }]);
    return true;
  }

  function remove(target: Draft) {
    setError(undefined);
    setItems(current => current.filter(item => !(item.phrase === target.phrase && item.negative === target.negative)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (positives.length === 0) {
      setError("Tambahkan minimal satu kata kunci pencarian.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      // Dikirim berurutan agar pesan batas kuota paket muncul apa adanya.
      for (const item of items) {
        const response = await fetch("/api/keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phrase: item.phrase, negative: item.negative }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(payload?.error ?? "Kata kunci belum dapat disimpan.");
        }
      }
      router.push("/onboarding/balasan");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kata kunci belum dapat disimpan.");
      setSaving(false);
    }
  }

  const unusedSuggestions = meta.suggestions.filter(
    suggestion => !items.some(item => item.phrase.toLowerCase() === suggestion.toLowerCase()),
  );

  return <form className="onboarding-form keyword-setup" onSubmit={event => void submit(event)}>
    <div className="keyword-setup__meter">
      <span><strong>{items.length}{limit === null ? "" : ` dari ${limit}`}</strong> kata kunci terpakai{meta.planName ? ` pada paket ${meta.planName}` : ""}</span>
      <span className="keyword-setup__split">{positives.length} pencarian · {negatives.length} eksklusi</span>
    </div>
    {limit !== null && <div className="keyword-setup__bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (items.length / limit) * 100)}%` }} /></div>}

    <div className="keyword-setup__columns">
      <section className="keyword-column">
        <header>
          <span className="keyword-column__icon keyword-column__icon--find"><Search size={15} /></span>
          <div>
            <h3>Kata kunci pencarian</h3>
            <p>Frasa yang diketik calon pelanggan saat mencari layanan Anda.</p>
          </div>
        </header>
        <div className="input-action">
          <input
            className="input"
            id="keyword"
            value={value}
            onChange={event => setValue(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (add(value, false)) setValue(""); } }}
            placeholder={`Contoh: ${meta.suggestions[0] ?? "jasa yang Anda tawarkan"}`}
            maxLength={120}
            disabled={saving || full}
            aria-label="Tambah kata kunci pencarian"
          />
          <button type="button" aria-label="Tambah kata kunci pencarian" disabled={saving || full} onClick={() => { if (add(value, false)) setValue(""); }}><Plus size={18} /></button>
        </div>
        <div className="keyword-list">{positives.map(item => <span key={`include-${item.phrase}`}>{item.phrase}<button type="button" aria-label={`Hapus ${item.phrase}`} disabled={saving} onClick={() => remove(item)}><X size={13} /></button></span>)}</div>
        {positives.length === 0 && <p className="keyword-column__empty">Minimal satu kata kunci pencarian diperlukan.</p>}

        {unusedSuggestions.length > 0 && !full && <div className="keyword-suggest-chips">
          <span><Lightbulb size={13} /> Saran untuk {meta.category}</span>
          <div>{unusedSuggestions.map(suggestion => (
            <button key={suggestion} type="button" disabled={saving} onClick={() => add(suggestion, false)}>+ {suggestion}</button>
          ))}</div>
        </div>}
      </section>

      <section className="keyword-column">
        <header>
          <span className="keyword-column__icon keyword-column__icon--exclude"><SlidersHorizontal size={15} /></span>
          <div>
            <h3>Kata kunci eksklusi <small>(opsional)</small></h3>
            <p>Postingan yang memuat istilah ini dibuang sebelum masuk ke feed.</p>
          </div>
        </header>
        <div className="input-action">
          <input
            className="input"
            id="exclude"
            value={excludeValue}
            onChange={event => setExcludeValue(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (add(excludeValue, true)) setExcludeValue(""); } }}
            placeholder="Contoh: gratis, lowongan"
            maxLength={120}
            disabled={saving || full}
            aria-label="Tambah kata kunci eksklusi"
          />
          <button type="button" aria-label="Tambah kata kunci eksklusi" disabled={saving || full} onClick={() => { if (add(excludeValue, true)) setExcludeValue(""); }}><Plus size={18} /></button>
        </div>
        <div className="keyword-list">{negatives.map(item => <span key={`exclude-${item.phrase}`}>{item.phrase}<button type="button" aria-label={`Hapus ${item.phrase}`} disabled={saving} onClick={() => remove(item)}><X size={13} /></button></span>)}</div>
        {negatives.length === 0 && <p className="keyword-column__empty">Boleh dikosongkan dan diisi nanti.</p>}
      </section>
    </div>

    <p className="onboarding-hint">Kata kunci terkunci 24 jam setelah ditambahkan supaya pencarian sempat berjalan sebelum diganti.</p>
    {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
    <button className="button button--primary" type="submit" disabled={saving || positives.length === 0}>{saving ? "Menyimpan..." : "Lanjutkan ke mode balasan"}</button>
  </form>;
}
