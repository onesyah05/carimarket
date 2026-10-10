"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";

/**
 * Pemantauan kredensial API.
 *
 * Halaman ini tidak lagi menerbitkan kredensial: pengguna memperoleh tokennya
 * sendiri lewat masuk dari aplikasi atau kode pemasangan. Tabel ini untuk
 * melihat token yang aktif dan mencabutnya bila perlu.
 */

export type Credential = {
  id: string;
  name: string;
  keyPrefix: string;
  userId: string;
  userEmail: string;
  userName: string;
  source: "SUPERADMIN" | "USER_LOGIN" | "USER_PAIRING";
  sourceLabel: string;
  issuedBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  status: "aktif" | "dicabut" | "kedaluwarsa";
};

const FILTERS = [
  { label: "Semua", value: "all" },
  { label: "Aktif", value: "aktif" },
  { label: "Dari aplikasi", value: "user" },
  { label: "Terbitan admin", value: "admin" },
] as const;

export function ApiCredentialsTable({ credentials }: { credentials: Credential[] }) {
  const [items, setItems] = useState(credentials);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("aktif");
  const [error, setError] = useState<string>();

  async function revoke(credential: Credential) {
    setError(undefined);
    const response = await fetch(`/api/admin/api-credentials/${encodeURIComponent(credential.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setError(payload?.error ?? "Kredensial belum dapat dicabut.");
      return;
    }
    const refreshed = await fetch("/api/admin/api-credentials", { cache: "no-store" });
    if (refreshed.ok) {
      const payload = await refreshed.json() as { data?: Credential[] };
      setItems(payload.data ?? []);
    }
  }

  const visible = items.filter(credential => {
    if (filter === "aktif") return credential.status === "aktif";
    if (filter === "user") return credential.source !== "SUPERADMIN";
    if (filter === "admin") return credential.source === "SUPERADMIN";
    return true;
  });

  return <>
    <div className="api-filter-bar" role="group" aria-label="Saring kredensial">
      {FILTERS.map(option => (
        <button key={option.value} type="button" className={filter === option.value ? "active" : ""} onClick={() => setFilter(option.value)}>
          {option.label}
        </button>
      ))}
    </div>

    {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}

    <div className="data-table internal-table">
      <div className="data-row data-head data-row--5"><span>Token</span><span>Workspace</span><span>Asal</span><span>Pemakaian terakhir</span><span>Aksi</span></div>
      {visible.length === 0 && <div className="data-row table-empty-row data-row--5"><span>{items.length === 0 ? "Belum ada token API pada platform ini." : "Tidak ada token yang cocok dengan filter."}</span></div>}
      {visible.map(credential => (
        <div className="data-row data-row--5" key={credential.id}>
          <span data-label="Token"><strong>{credential.name}</strong><br /><small><code>{credential.keyPrefix}_…</code></small></span>
          <span data-label="Workspace">{credential.userName}<br /><small>{credential.userEmail}</small></span>
          <span data-label="Asal">{credential.sourceLabel}{credential.issuedBy ? <><br /><small>oleh {credential.issuedBy}</small></> : null}</span>
          <span data-label="Pemakaian terakhir">{credential.lastUsedAt ? formatDateTime(credential.lastUsedAt) : "Belum pernah dipakai"}<br /><small>{credential.status === "aktif" ? (credential.expiresAt ? `berlaku s.d. ${formatDateTime(credential.expiresAt)}` : "tanpa kedaluwarsa") : credential.status}</small></span>
          <span data-label="Aksi" className="row-actions">
            {credential.status === "aktif"
              ? <button className="button button--danger button--small" type="button" onClick={() => void revoke(credential)}><Trash2 size={15} /> Cabut</button>
              : <small>—</small>}
          </span>
        </div>
      ))}
    </div>
  </>;
}
