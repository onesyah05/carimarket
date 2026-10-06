"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { statusLabel } from "@/lib/format";

const PERMISSION_KEYS = ["SUPPORT_READ", "SUPPORT_REPLY", "MODERATION_REVIEW", "CONTENT_DRAFT"] as const;

type AdminRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  permissions: string[];
};

export function AdminsManager({ admins }: { admins: AdminRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promotePermissions, setPromotePermissions] = useState<string[]>(["SUPPORT_READ"]);
  const [draftPermissions, setDraftPermissions] = useState<Record<string, string[]>>(() => Object.fromEntries(admins.filter(a => a.role === "ADMIN").map(a => [a.id, a.permissions])));

  async function call(method: string, body: unknown, label: string) {
    setPending(label);
    setError(null);
    try {
      const response = await fetch("/api/admin/admins", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Aksi belum berhasil.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Tidak dapat menghubungi server.");
      return false;
    } finally {
      setPending(null);
    }
  }

  function togglePermission(list: string[], key: string, setter: (next: string[]) => void) {
    setter(list.includes(key) ? list.filter(item => item !== key) : [...list, key]);
  }

  return (
    <>
      <section className="panel mini-form-panel">
        <strong>Jadikan Admin</strong>
        <p>Promosikan akun pengguna yang sudah terdaftar menjadi Admin operasional.</p>
        <form
          className="mini-form"
          onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const email = String(form.get("email") ?? "").trim();
            if (promotePermissions.length === 0) {
              setError("Pilih minimal satu permission.");
              return;
            }
            void call("POST", { email, permissions: promotePermissions }, "promote").then(ok => ok && (event.target as HTMLFormElement).reset());
          }}
        >
          <input className="input" name="email" type="email" placeholder="email@pengguna" required />
          <div className="checkbox-row">
            {PERMISSION_KEYS.map(key => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={promotePermissions.includes(key)}
                  onChange={() => togglePermission(promotePermissions, key, setPromotePermissions)}
                /> {statusLabel(key)}
              </label>
            ))}
          </div>
          <button className="button button--primary button--small" type="submit" disabled={pending !== null}>
            {pending === "promote" ? "Memproses…" : "Jadikan Admin"}
          </button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>

      <section className="panel table-panel">
        <div className="panel-heading internal-panel-heading"><div><h2>Tim internal</h2><p>Hak akses Admin dan status akun.</p></div><span className="internal-count">{admins.length.toLocaleString("id-ID")} total</span></div>
        <div className="data-table internal-table">
          {admins.length === 0 && <div className="table-empty"><strong>Belum ada tim internal.</strong><p>Promosikan pengguna menjadi Admin lewat formulir di atas.</p></div>}
          {admins.map(admin => (
            <div className="data-row stack-row" key={admin.id}>
              <div className="stack-row__top">
                <strong>{admin.name}</strong>
                <small>{admin.email}</small>
                <span className="chip chip--draft">{statusLabel(admin.role)}</span>
                {admin.status === "ACTIVE" ? <span className="chip chip--published">Aktif</span> : <span className="chip chip--archived">{statusLabel(admin.status)}</span>}
              </div>
              {admin.role === "SUPERADMIN" ? (
                <div className="stack-row__meta"><span>Akun tertinggi dengan semua akses. Permission tidak dapat diubah.</span></div>
              ) : (
                <>
                  <div className="stack-row__meta checkbox-row">
                    {PERMISSION_KEYS.map(key => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={(draftPermissions[admin.id] ?? admin.permissions).includes(key)}
                          onChange={() => togglePermission(draftPermissions[admin.id] ?? admin.permissions, key, next => setDraftPermissions(current => ({ ...current, [admin.id]: next })))}
                        /> {statusLabel(key)}
                      </label>
                    ))}
                  </div>
                  <div className="stack-row__actions">
                    <button className="button button--small button--ghost" type="button" disabled={pending !== null} onClick={() => void call("PATCH", { userId: admin.id, permissions: draftPermissions[admin.id] ?? [] }, `save-${admin.id}`)}>
                      {pending === `save-${admin.id}` ? "Menyimpan…" : "Simpan permission"}
                    </button>
                    <button className="button button--small button--danger" type="button" disabled={pending !== null} onClick={() => { if (window.confirm(`Turunkan ${admin.name} menjadi pengguna biasa?`)) void call("DELETE", { userId: admin.id }, `demote-${admin.id}`); }}>
                      {pending === `demote-${admin.id}` ? "…" : "Turunkan menjadi pengguna"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
