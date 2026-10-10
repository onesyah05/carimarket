"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

type Draft = { phrase: string; negative: boolean };

export function KeywordStep() {
  const router = useRouter();
  const [items, setItems] = useState<Draft[]>([]);
  const [value, setValue] = useState("");
  const [excludeValue, setExcludeValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  function add(phrase: string, negative: boolean) {
    const next = phrase.trim();
    if (next.length < 2) return;
    setError(undefined);
    setItems(current => current.some(item => item.phrase.toLowerCase() === next.toLowerCase() && item.negative === negative)
      ? current
      : [...current, { phrase: next, negative }]);
  }

  function remove(target: Draft) {
    setItems(current => current.filter(item => !(item.phrase === target.phrase && item.negative === target.negative)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const positives = items.filter(item => !item.negative);
    if (positives.length === 0) {
      setError("Tambahkan minimal satu kata kunci utama.");
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

  const positives = items.filter(item => !item.negative);
  const negatives = items.filter(item => item.negative);

  return <form className="onboarding-form" onSubmit={event => void submit(event)}>
    <div className="field">
      <label htmlFor="keyword">Kata kunci utama</label>
      <div className="input-action">
        <input className="input" id="keyword" value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(value, false); setValue(""); } }} placeholder="Contoh: jasa drone" maxLength={120} disabled={saving} />
        <button type="button" aria-label="Tambah kata kunci" disabled={saving} onClick={() => { add(value, false); setValue(""); }}><Plus size={18} /></button>
      </div>
    </div>
    <div className="keyword-list">{positives.map(item => <span key={`include-${item.phrase}`}>{item.phrase}<button type="button" aria-label={`Hapus ${item.phrase}`} disabled={saving} onClick={() => remove(item)}><X size={13} /></button></span>)}</div>

    <div className="field">
      <label htmlFor="exclude">Kata negatif <small>(opsional)</small></label>
      <div className="input-action">
        <input className="input" id="exclude" value={excludeValue} onChange={event => setExcludeValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(excludeValue, true); setExcludeValue(""); } }} placeholder="Contoh: gratis, lowongan" maxLength={120} disabled={saving} />
        <button type="button" aria-label="Tambah kata negatif" disabled={saving} onClick={() => { add(excludeValue, true); setExcludeValue(""); }}><Plus size={18} /></button>
      </div>
    </div>
    <div className="keyword-list">{negatives.map(item => <span key={`exclude-${item.phrase}`}>{item.phrase}<button type="button" aria-label={`Hapus ${item.phrase}`} disabled={saving} onClick={() => remove(item)}><X size={13} /></button></span>)}</div>
    <p className="onboarding-hint">Kata negatif menyaring postingan yang memuat istilah tersebut sebelum masuk ke feed lead.</p>

    {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
    <button className="button button--primary" type="submit" disabled={saving || positives.length === 0}>{saving ? "Menyimpan..." : "Lanjutkan ke mode balasan"}</button>
  </form>;
}
