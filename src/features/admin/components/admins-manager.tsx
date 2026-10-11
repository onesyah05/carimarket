"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { FormModal } from "@/components/form-modal";
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
  const [promoting, setPromoting] = useState(false);
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
      <div className="plans-actions">
        <button className="button button--primary" type="button" onClick={() => { setPromoting(true); setError(null); }}>
          <Plus size={16} /> Tambah admin
        </button>
        {error && !promoting && <span className="form-feedback form-feedback--error" role="alert">{error}</span>}
      </div>

      {promoting && <FormModal
        title="Jadikan Admin"
        description="Promosikan akun pengguna yang sudah terdaftar menjadi Admin operasional. Permission menentukan apa yang dapat mereka kerjakan."
        busy={pending === "promote"}
        onClose={() => { setPromoting(false); setError(null); }}
      >
        <form
          className="plan-form"
          onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const email = String(form.get("email") ?? "").trim();
            if (promotePermissions.length === 0) {
              setError("Pilih minimal satu permission.");
              return;
            }
            const element = event.currentTarget;
            void call("POST", { email, permissions: promotePermissions }, "promote").then(ok => {
              if (!ok) return;
              element.reset();
              setPromoting(false);
            });
          }}
        >
          <div className="field plan-form__toggle">
            <label htmlFor="promote-email">Email pengguna</label>
            <input className="input" id="promote-email" name="email" type="email" placeholder="email@pengguna" required disabled={pending === "promote"} />
            <small className="field-hint">Akun harus sudah terdaftar sebagai pengguna.</small>
          </div>
          <div className="field plan-form__toggle">
            <label>Permission</label>
            <div className="checkbox-row">
              {PERMISSION_KEYS.map(key => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={promotePermissions.includes(key)}
                    disabled={pending === "promote"}
                    onChange={() => togglePermission(promotePermissions, key, setPromotePermissions)}
                  /> {statusLabel(key)}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="form-feedback form-feedback--error plan-form__feedback" role="alert">{error}</p>}
          <div className="plan-form__actions">
            <button className="button button--primary" type="submit" disabled={pending !== null}>{pending === "promote" ? "Memproses…" : "Jadikan Admin"}</button>
            <button className="button button--ghost" type="button" onClick={() => { setPromoting(false); setError(null); }} disabled={pending === "promote"}>Batal</button>
          </div>
        </form>
      </FormModal>}

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
