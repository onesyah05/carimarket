"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export function KeywordStep() {
  const [items, setItems] = useState(["jasa drone", "foto udara"]);
  const [value, setValue] = useState("");
  const add = () => { const next = value.trim(); if (next && !items.includes(next)) setItems(current => [...current, next]); setValue(""); };
  return <form className="onboarding-form" action="/onboarding/balasan"><div className="field"><label htmlFor="keyword">Kata kunci utama</label><div className="input-action"><input className="input" id="keyword" value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder="Contoh: jasa drone" /><button type="button" aria-label="Tambah kata kunci" onClick={add}><Plus size={18} /></button></div></div><div className="keyword-list">{items.map(item => <span key={item}>{item}<button type="button" aria-label={`Hapus ${item}`} onClick={() => setItems(current => current.filter(value => value !== item))}><X size={13} /></button></span>)}</div><div className="field"><label htmlFor="exclude">Kata negatif <small>(opsional)</small></label><input className="input" id="exclude" placeholder="Contoh: gratis, lowongan" /></div><button className="button button--primary" type="submit" disabled={items.length === 0}>Lanjutkan ke mode balasan</button></form>;
}
