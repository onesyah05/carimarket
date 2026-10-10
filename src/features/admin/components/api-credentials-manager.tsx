"use client";

import { FormEvent, useState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Credential = {
  id: string;
  name: string;
  keyPrefix: string;
  userId: string;
  userEmail: string;
  userName: string;
  issuedBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  status: "aktif" | "dicabut" | "kedaluwarsa";
};

type Target = { id: string; name: string; email: string; status: string; businessName: string | null };

type Issued = { id: string; name: string; keyPrefix: string; key: string; expiresAt: string | null };

const EXPIRY_OPTIONS = [
  { label: "Tanpa kedaluwarsa", value: "" },
  { label: "30 hari", value: "30" },
  { label: "90 hari", value: "90" },
  { label: "365 hari", value: "365" },
];

export function ApiCredentialsManager({ credentials, targets }: { credentials: Credential[]; targets: Target[] }) {
  const [items, setItems] = useState(credentials);
  const [userId, setUserId] = useState(targets[0]?.id ?? "");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [issued, setIssued] = useState<Issued>();
  const [copied, setCopied] = useState(false);

  async function refresh() {
    const response = await fetch("/api/admin/api-credentials", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { data?: Credential[] };
    if (payload.data) setItems(payload.data);
  }

  async function issue(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setIssued(undefined);
    setCopied(false);
    try {
      const response = await fetch("/api/admin/api-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name, expiresInDays: expiry ? Number(expiry) : null }),
      });
      const payload = await response.json() as { data?: Issued; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Kredensial belum dapat diterbitkan.");
      setIssued(payload.data);
      setName("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kredensial belum dapat diterbitkan.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(credential: Credential) {
    setError(undefined);
    const response = await fetch(`/api/admin/api-credentials/${encodeURIComponent(credential.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setError(payload?.error ?? "Kredensial belum dapat dicabut.");
      return;
    }
    await refresh();
  }

  async function copyKey() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return <>
    <section className="panel mini-form-panel">
      <strong>Terbitkan kredensial</strong>
      <p>Kredensial hanya dapat diterbitkan di sini dan selalu terikat pada satu workspace pengguna bisnis. Aplikasi mobile memakainya pada header <code>Authorization: Bearer</code>.</p>
      {targets.length === 0
        ? <p className="form-feedback form-feedback--error" role="alert">Belum ada akun pengguna bisnis yang dapat diberi kredensial.</p>
        : <form className="api-credential-form" onSubmit={event => void issue(event)}>
          <div className="field">
            <label htmlFor="credential-user">Workspace pengguna</label>
            <select className="input" id="credential-user" value={userId} onChange={event => setUserId(event.target.value)} disabled={busy} required>
              {targets.map(target => (
                <option key={target.id} value={target.id}>
                  {target.businessName ? `${target.businessName} — ` : ""}{target.name} ({target.email}){target.status === "ACTIVE" ? "" : " · belum aktif"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="credential-name">Nama kredensial</label>
            <input className="input" id="credential-name" value={name} onChange={event => setName(event.target.value)} placeholder="Contoh: Aplikasi Android produksi" minLength={2} maxLength={120} disabled={busy} required />
          </div>
          <div className="field">
            <label htmlFor="credential-expiry">Masa berlaku</label>
            <select className="input" id="credential-expiry" value={expiry} onChange={event => setExpiry(event.target.value)} disabled={busy}>
              {EXPIRY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <button className="button button--primary" type="submit" disabled={busy || !userId}><Plus size={16} /> {busy ? "Menerbitkan..." : "Terbitkan"}</button>
        </form>}
      {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
    </section>

    {issued && <section className="panel api-issued" aria-live="polite">
      <div className="api-issued__head"><KeyRound size={18} /><div><strong>Kunci untuk “{issued.name}” berhasil dibuat</strong><span>Salin sekarang. Nilai ini tidak dapat ditampilkan ulang karena hanya hash-nya yang disimpan.</span></div></div>
      <code className="api-issued__key">{issued.key}</code>
      <div className="api-issued__actions">
        <button className="button button--ghost button--small" type="button" onClick={() => void copyKey()}><Copy size={15} /> {copied ? "Tersalin" : "Salin kunci"}</button>
        <button className="button button--ghost button--small" type="button" onClick={() => setIssued(undefined)}>Sembunyikan</button>
      </div>
    </section>}

    <section className="panel table-panel">
      <div className="panel-heading internal-panel-heading"><div><h2>Kredensial terbit</h2><p>Nilai kunci tidak pernah ditampilkan ulang; kolom kunci hanya memuat prefiks.</p></div><span className="internal-count">{items.length.toLocaleString("id-ID")} total</span></div>
      <div className="data-table internal-table">
        <div className="data-row data-head data-row--5"><span>Kredensial</span><span>Workspace</span><span>Pemakaian terakhir</span><span>Status</span><span>Aksi</span></div>
        {items.length === 0 && <div className="data-row table-empty-row data-row--5"><span>Belum ada kredensial API yang diterbitkan.</span></div>}
        {items.map(credential => (
          <div className="data-row data-row--5" key={credential.id}>
            <span data-label="Kredensial"><strong>{credential.name}</strong><br /><small><code>{credential.keyPrefix}_…</code></small></span>
            <span data-label="Workspace">{credential.userName}<br /><small>{credential.userEmail}</small></span>
            <span data-label="Pemakaian terakhir">{credential.lastUsedAt ? formatDateTime(credential.lastUsedAt) : "Belum pernah dipakai"}<br /><small>Terbit {formatDateTime(credential.createdAt)}{credential.issuedBy ? ` oleh ${credential.issuedBy}` : ""}</small></span>
            <span data-label="Status">{credential.status}{credential.expiresAt ? <><br /><small>s.d. {formatDateTime(credential.expiresAt)}</small></> : null}</span>
            <span data-label="Aksi" className="row-actions">
              {credential.status === "aktif"
                ? <button className="button button--danger button--small" type="button" onClick={() => void revoke(credential)}><Trash2 size={15} /> Cabut</button>
                : <small>—</small>}
            </span>
          </div>
        ))}
      </div>
    </section>
  </>;
}
