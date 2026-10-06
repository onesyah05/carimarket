"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Clock3, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import { replySuggestions, type ReplyTone } from "@/features/replies/lib/reply-suggestions";

type Props = {
  leadId: string;
  postId?: string;
  author: string;
  keyword: string;
  profile: { name: string; category: string; serviceArea: string | null } | null;
  initialDraft: { id: string; body: string; status: string } | null;
  connected: boolean;
};

const checks = [
  "Balasan menjawab kebutuhan yang disebutkan",
  "Informasi bisnis dan klaim di balasan sudah benar",
  "Saya telah membaca isi akhir dan setuju memublikasikannya",
];

export function ReplyComposer({ leadId, postId, author, keyword, profile, initialDraft, connected }: Props) {
  const suggestions = profile ? replySuggestions({ author, keyword, businessName: profile.name, category: profile.category, serviceArea: profile.serviceArea }) : null;
  const [tone, setTone] = useState<ReplyTone>("Ramah & profesional");
  const [body, setBody] = useState(initialDraft?.body ?? suggestions?.["Ramah & profesional"] ?? "");
  const [draftId, setDraftId] = useState(initialDraft?.id);
  const [draftStatus, setDraftStatus] = useState(initialDraft?.status);
  const [checked, setChecked] = useState([false, false, false]);
  const [busy, setBusy] = useState<"saving" | "sending" | null>(null);
  const [saved, setSaved] = useState(Boolean(initialDraft));
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(initialDraft?.status === "SENT" || initialDraft?.status === "SIMULATED_SENT");
  const locked = draftStatus === "SCHEDULED" || draftStatus === "SENDING" || draftStatus === "APPROVED";

  function changeBody(next: string) {
    setBody(next);
    setSaved(false);
    setChecked([false, false, false]);
    setError(undefined);
  }

  async function saveDraft() {
    setBusy("saving");
    setError(undefined);
    try {
      const response = await fetch("/api/leads/" + encodeURIComponent(leadId) + "/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, body }),
      });
      const payload = await response.json() as { error?: string; data?: { id: string; status: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Draf belum dapat disimpan.");
      setDraftId(payload.data.id);
      setDraftStatus(payload.data.status);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Draf belum dapat disimpan.");
    } finally {
      setBusy(null);
    }
  }

  async function sendReply() {
    if (!postId) { setError("ID postingan Threads tidak tersedia. Jalankan pencarian ulang."); return; }
    setBusy("sending");
    setError(undefined);
    try {
      const response = await fetch("/api/threads/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, postId, draftId, body, confirmed: true, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json() as { error?: string; data?: { status?: string } };
      if (!response.ok) throw new Error(payload.error ?? "Balasan belum dapat dikirim.");
      if (payload.data?.status !== "SENT" && payload.data?.status !== "SIMULATED_SENT") throw new Error("Balasan belum dapat dikirim ke Threads.");
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Balasan belum dapat dikirim.");
    } finally {
      setBusy(null);
    }
  }

  if (sent) return <div className="sent-state"><span><Check /></span><h2>Balasan sudah dikirim</h2><p>Balasan untuk postingan ini tercatat di riwayat.</p><Link className="button button--primary" href="/dashboard/riwayat">Lihat riwayat</Link></div>;
  return <div className="composer">
    <div className="composer-title"><span><MessageSquareText size={18} /></span><div><h2>Draf balasan</h2><p>{profile ? "Saran berdasarkan profil " + profile.name + " dan kata kunci lead." : "Tulis balasan berdasarkan kebutuhan pada postingan."}</p></div>{suggestions && <button type="button" disabled={Boolean(busy) || locked} onClick={() => { const next = tone === "Ramah & profesional" ? "Singkat" : tone === "Singkat" ? "Informatif" : "Ramah & profesional"; setTone(next); changeBody(suggestions[next]); }}>Buat variasi</button>}</div>
    {!profile && <p className="composer-info">Profil bisnis belum tersedia. <Link href="/dashboard/pengaturan">Lengkapi profil bisnis</Link> agar saran balasan sesuai usaha Anda.</p>}
    {!connected && <p className="composer-info">Akun Threads belum terhubung. Anda dapat menyimpan draf, lalu <Link href="/dashboard/pengaturan">hubungkan Threads</Link> sebelum mengirim.</p>}
    {locked && <p className="composer-info">Draf ini sedang diproses. Periksa status terbaru di riwayat balasan.</p>}
    <label className="sr-only" htmlFor="reply">Isi balasan</label><textarea id="reply" value={body} onChange={event => changeBody(event.target.value)} maxLength={500} disabled={Boolean(busy) || locked} placeholder="Tulis balasan yang relevan dengan postingan ini..." />
    <div className="composer-count">{body.length}/500</div>
    {suggestions && <div className="tone-row"><span>Nada</span>{(Object.keys(suggestions) as ReplyTone[]).map(item => <button type="button" className={tone === item ? "active" : ""} key={item} disabled={Boolean(busy) || locked} onClick={() => { setTone(item); changeBody(suggestions[item]); }}>{item}</button>)}</div>}
    <div className="approval-box"><div className="approval-title"><ShieldCheck size={18} /><div><strong>Periksa sebelum mengirim</strong><span>Balasan akan dipublikasikan setelah Anda menyetujui isi akhirnya.</span></div></div>{checks.map((label, index) => <label key={label}><input type="checkbox" checked={checked[index]} disabled={Boolean(busy) || locked} onChange={() => setChecked(values => values.map((value, i) => i === index ? !value : value))} /><span>{label}</span></label>)}</div>
    {error && <div className="inline-error" role="alert"><strong>Tindakan belum berhasil.</strong><span>{error}</span></div>}
    <div className="composer-actions"><button className="button button--ghost" type="button" onClick={() => void saveDraft()} disabled={Boolean(busy) || locked || !body.trim()}>{busy === "saving" ? "Menyimpan..." : saved ? "Draf tersimpan" : "Simpan draf"}</button><button className="button button--primary" type="button" disabled={Boolean(busy) || locked || !connected || !postId || checked.some(value => !value) || body.trim().length < 20} onClick={() => void sendReply()}>{busy === "sending" ? <Clock3 className="spin" size={16} /> : <Send size={16} />} {busy === "sending" ? "Mengirim..." : "Kirim ke Threads"}</button></div>
    <p className="composer-disclaimer">Simpan draf tidak mengirim balasan. Tombol kirim memublikasikan balasan melalui akun Threads yang terhubung.</p>
  </div>;
}
