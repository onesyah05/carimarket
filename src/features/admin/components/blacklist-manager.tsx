"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { FormModal } from "@/components/form-modal";

/**
 * Kontrol daftar istilah terlarang.
 *
 * Dulu komponen ini juga merender daftarnya sendiri; daftarnya kini ditangani
 * `BlacklistTable` bersama pencarian dan penomoran halaman, jadi yang tersisa
 * di sini hanya dua tindakannya: menambah dan menghapus.
 *
 * Keduanya melapor lewat `onChanged` supaya tabel memuat ulang halaman yang
 * sedang tampil — `router.refresh()` saja tidak cukup karena barisnya diambil
 * lewat API, bukan dari render server.
 */

type ChangeHandler = { onChanged?: () => void };

async function callBlacklist(method: "POST" | "DELETE", body: unknown) {
  const response = await fetch("/api/admin/blacklist", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Permintaan belum berhasil.");
}

export function BlacklistAddButton({ onChanged }: ChangeHandler) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addTerm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    try {
      await callBlacklist("POST", {
        term: data.get("term"),
        reason: String(data.get("reason") ?? "").trim() || undefined,
      });
      form.reset();
      setOpen(false);
      router.refresh();
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Istilah belum tersimpan.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className="button button--primary" type="button" onClick={() => { setOpen(true); setError(null); }}>
        <Plus size={16} /> Tambah istilah
      </button>

      {open && <FormModal
        title="Tambah istilah terlarang"
        description="Draft balasan yang memuat istilah ini ditahan untuk ditinjau sebelum dikirim."
        busy={pending}
        onClose={() => { setOpen(false); setError(null); }}
      >
        <form className="plan-form" onSubmit={event => void addTerm(event)}>
          <div className="field">
            <label htmlFor="blacklist-term">Istilah</label>
            <input className="input" id="blacklist-term" name="term" placeholder="Mis. dijamin" required minLength={2} maxLength={120} disabled={pending} />
          </div>
          <div className="field">
            <label htmlFor="blacklist-reason">Alasan (opsional)</label>
            <input className="input" id="blacklist-reason" name="reason" placeholder="Mis. klaim berlebihan" maxLength={255} disabled={pending} />
          </div>
          {error && <p className="form-feedback form-feedback--error plan-form__feedback" role="alert">{error}</p>}
          <div className="plan-form__actions">
            <button className="button button--primary" type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Tambah istilah"}</button>
            <button className="button button--ghost" type="button" onClick={() => { setOpen(false); setError(null); }} disabled={pending}>Batal</button>
          </div>
        </form>
      </FormModal>}
    </>
  );
}

export function BlacklistRowActions({ id, term, onChanged }: ChangeHandler & { id: string; term: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeTerm() {
    if (!window.confirm(`Hapus istilah "${term}"? Draft yang memuatnya tidak akan ditahan lagi.`)) return;
    setPending(true);
    setError(null);
    try {
      await callBlacklist("DELETE", { id });
      router.refresh();
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Istilah belum terhapus.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="row-actions">
      <button className="button button--small button--danger" type="button" disabled={pending} onClick={() => void removeTerm()}>
        <Trash2 size={13} /> {pending ? "…" : "Hapus"}
      </button>
      {error && <span className="row-error" role="alert">{error}</span>}
    </span>
  );
}
