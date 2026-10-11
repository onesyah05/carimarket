"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { FormModal } from "@/components/form-modal";
import { formatDateTime } from "@/lib/format";

type TermRow = { id: string; term: string; reason: string | null; createdAt: string; creator: string | null };

export function BlacklistManager({ terms }: { terms: TermRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function addTerm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending("add");
    setError(null);
    try {
      const response = await fetch("/api/admin/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: data.get("term"), reason: String(data.get("reason") ?? "").trim() || undefined }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Istilah belum tersimpan.");
        return;
      }
      form.reset();
      setAdding(false);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(null);
    }
  }

  async function removeTerm(id: string) {
    setPending(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/blacklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Istilah belum terhapus.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <div className="plans-actions">
        <button className="button button--primary" type="button" onClick={() => { setAdding(true); setError(null); }}>
          <Plus size={16} /> Tambah istilah
        </button>
        {error && !adding && <span className="form-feedback form-feedback--error" role="alert">{error}</span>}
      </div>

      {adding && <FormModal
        title="Tambah istilah terlarang"
        description="Draft balasan yang memuat istilah ini ditahan untuk ditinjau sebelum dikirim."
        busy={pending === "add"}
        onClose={() => { setAdding(false); setError(null); }}
      >
        <form className="plan-form" onSubmit={addTerm}>
          <div className="field">
            <label htmlFor="blacklist-term">Istilah</label>
            <input className="input" id="blacklist-term" name="term" placeholder="Mis. dijamin" required minLength={2} maxLength={120} disabled={pending === "add"} />
          </div>
          <div className="field">
            <label htmlFor="blacklist-reason">Alasan (opsional)</label>
            <input className="input" id="blacklist-reason" name="reason" placeholder="Mis. klaim berlebihan" maxLength={255} disabled={pending === "add"} />
          </div>
          {error && <p className="form-feedback form-feedback--error plan-form__feedback" role="alert">{error}</p>}
          <div className="plan-form__actions">
            <button className="button button--primary" type="submit" disabled={pending !== null}>{pending === "add" ? "Menyimpan…" : "Tambah istilah"}</button>
            <button className="button button--ghost" type="button" onClick={() => { setAdding(false); setError(null); }} disabled={pending === "add"}>Batal</button>
          </div>
        </form>
      </FormModal>}

      <section className="panel table-panel">
        <div className="panel-heading internal-panel-heading"><div><h2>Daftar istilah</h2><p>Istilah yang digunakan untuk menahan draft berisiko.</p></div><span className="internal-count">{terms.length.toLocaleString("id-ID")} total</span></div>
        <div className="data-table internal-table">
          <div className="data-row data-head data-row--4"><span>Istilah</span><span>Alasan</span><span>Ditambahkan</span><span>Aksi</span></div>
          {terms.length === 0 && <div className="data-row table-empty-row"><span>Daftar masih kosong.</span></div>}
          {terms.map(term => (
            <div className="data-row data-row--4" key={term.id}>
              <span data-label="Istilah"><strong>{term.term}</strong></span>
              <span data-label="Alasan">{term.reason ?? "—"}</span>
              <span data-label="Ditambahkan">{formatDateTime(term.createdAt)}{term.creator ? ` · ${term.creator}` : ""}</span>
              <span data-label="Aksi" className="row-actions">
                <button className="button button--small button--danger" type="button" disabled={pending !== null} onClick={() => void removeTerm(term.id)}>
                  {pending === term.id ? "…" : "Hapus"}
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
