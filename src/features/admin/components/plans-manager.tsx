"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Pencil, Plus, X } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import type { AdminPlan } from "@/server/plans/admin";

/**
 * Pengelolaan paket langganan.
 *
 * Harga dan kuota yang disimpan di sini langsung berlaku: ditegakkan server
 * saat pengguna mencari dan membalas, dan tampil di halaman harga publik.
 * Peringatan kuota dari server ditampilkan apa adanya agar kombinasi yang
 * tidak masuk akal tidak lolos tanpa disadari.
 */

type FormState = {
  code: string;
  name: string;
  monthlyPrice: string;
  monthlySearchLimit: string;
  monthlyReplyLimit: string;
  keywordLimit: string;
  searchIntervalHours: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  monthlyPrice: "0",
  monthlySearchLimit: "300",
  monthlyReplyLimit: "30",
  keywordLimit: "3",
  searchIntervalHours: "24",
  isActive: true,
};

function toForm(plan: AdminPlan): FormState {
  return {
    code: plan.code,
    name: plan.name,
    monthlyPrice: String(plan.monthlyPrice),
    monthlySearchLimit: String(plan.monthlySearchLimit),
    monthlyReplyLimit: String(plan.monthlyReplyLimit),
    keywordLimit: String(plan.keywordLimit),
    searchIntervalHours: String(plan.searchIntervalHours),
    isActive: plan.isActive,
  };
}

function toPayload(form: FormState, includeCode: boolean) {
  return {
    ...(includeCode ? { code: form.code.trim().toUpperCase() } : {}),
    name: form.name.trim(),
    monthlyPrice: Number(form.monthlyPrice),
    monthlySearchLimit: Number(form.monthlySearchLimit),
    monthlyReplyLimit: Number(form.monthlyReplyLimit),
    keywordLimit: Number(form.keywordLimit),
    searchIntervalHours: Number(form.searchIntervalHours),
    isActive: form.isActive,
  };
}

function limitText(value: number) {
  return value > 0 ? value.toLocaleString("id-ID") : "tanpa batas";
}

export function PlansManager({ plans }: { plans: AdminPlan[] }) {
  const [items, setItems] = useState(plans);
  const [mode, setMode] = useState<{ kind: "closed" } | { kind: "create" } | { kind: "edit"; plan: AdminPlan }>({ kind: "closed" });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();

  function openCreate() {
    setForm(EMPTY_FORM);
    setMode({ kind: "create" });
    setError(undefined);
    setSaved(undefined);
  }

  function openEdit(plan: AdminPlan) {
    setForm(toForm(plan));
    setMode({ kind: "edit", plan });
    setError(undefined);
    setSaved(undefined);
  }

  function close() {
    setMode({ kind: "closed" });
    setError(undefined);
  }

  function update(key: keyof FormState, value: string | boolean) {
    setForm(current => ({ ...current, [key]: value }));
    setError(undefined);
    setSaved(undefined);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode.kind === "closed") return;
    setBusy(true);
    setError(undefined);
    try {
      const creating = mode.kind === "create";
      const response = await fetch(creating ? "/api/admin/plans" : `/api/admin/plans/${encodeURIComponent(mode.plan.id)}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form, creating)),
      });
      const payload = await response.json() as { data?: AdminPlan[]; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Paket belum dapat disimpan.");
      setItems(payload.data);
      setSaved(creating ? `Paket ${form.code.toUpperCase()} dibuat.` : `Paket ${form.code} diperbarui.`);
      setMode({ kind: "closed" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paket belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  const projected = Number(form.keywordLimit) * (24 / Math.max(1, Number(form.searchIntervalHours))) * 30;

  return <>
    <div className="plans-actions">
      <button className="button button--primary" type="button" onClick={openCreate}><Plus size={16} /> Tambah paket</button>
      {saved && <span className="form-feedback form-feedback--success" role="status">{saved}</span>}
    </div>

    {mode.kind !== "closed" && <section className="panel plan-form-panel">
      <div className="panel-heading internal-panel-heading">
        <div>
          <h2>{mode.kind === "create" ? "Paket baru" : `Ubah paket ${mode.plan.code}`}</h2>
          <p>Kuota ditegakkan server dan tampil di halaman harga. Batas bernilai 0 berarti tanpa batas.</p>
        </div>
        <button className="icon-button" type="button" aria-label="Tutup form" onClick={close}><X size={18} /></button>
      </div>

      <form className="plan-form" onSubmit={event => void submit(event)}>
        <div className="field">
          <label htmlFor="plan-code">Kode</label>
          <input className="input" id="plan-code" value={form.code} onChange={event => update("code", event.target.value.toUpperCase())} placeholder="BISNIS" disabled={busy || mode.kind === "edit"} required />
          {mode.kind === "edit" && <small className="field-hint">Kode tidak dapat diubah karena dipakai langganan dan katalog.</small>}
        </div>
        <div className="field">
          <label htmlFor="plan-name">Nama</label>
          <input className="input" id="plan-name" value={form.name} onChange={event => update("name", event.target.value)} placeholder="Bisnis" minLength={2} maxLength={100} disabled={busy} required />
        </div>
        <div className="field">
          <label htmlFor="plan-price">Harga per bulan (Rupiah)</label>
          <input className="input" id="plan-price" type="number" min="0" step="1000" value={form.monthlyPrice} onChange={event => update("monthlyPrice", event.target.value)} disabled={busy} required />
          <small className="field-hint">{formatRupiah(Number(form.monthlyPrice) || 0)}</small>
        </div>
        <div className="field">
          <label htmlFor="plan-keywords">Batas kata kunci</label>
          <input className="input" id="plan-keywords" type="number" min="0" max="1000" value={form.keywordLimit} onChange={event => update("keywordLimit", event.target.value)} disabled={busy} required />
        </div>
        <div className="field">
          <label htmlFor="plan-interval">Interval pencarian (jam)</label>
          <input className="input" id="plan-interval" type="number" min="1" max="168" value={form.searchIntervalHours} onChange={event => update("searchIntervalHours", event.target.value)} disabled={busy} required />
          <small className="field-hint">Jadwal penuh: {Math.round(projected).toLocaleString("id-ID")} pencarian per bulan.</small>
        </div>
        <div className="field">
          <label htmlFor="plan-searches">Kuota pencarian per bulan</label>
          <input className="input" id="plan-searches" type="number" min="0" max="1000000" value={form.monthlySearchLimit} onChange={event => update("monthlySearchLimit", event.target.value)} disabled={busy} required />
        </div>
        <div className="field">
          <label htmlFor="plan-replies">Kuota balasan per bulan</label>
          <input className="input" id="plan-replies" type="number" min="0" max="1000000" value={form.monthlyReplyLimit} onChange={event => update("monthlyReplyLimit", event.target.value)} disabled={busy} required />
        </div>
        <label className="safety-toggle plan-form__toggle">
          <input type="checkbox" checked={form.isActive} onChange={event => update("isActive", event.target.checked)} disabled={busy} />
          <span><strong>Paket aktif</strong><small>Paket aktif tampil di halaman harga dan dapat menjadi batas bawaan bila termurah.</small></span>
        </label>

        {error && <p className="form-feedback form-feedback--error plan-form__feedback" role="alert">{error}</p>}
        <div className="plan-form__actions">
          <button className="button button--primary" type="submit" disabled={busy}>{busy ? "Menyimpan..." : mode.kind === "create" ? "Buat paket" : "Simpan perubahan"}</button>
          <button className="button button--ghost" type="button" onClick={close} disabled={busy}>Batal</button>
        </div>
      </form>
    </section>}

    <section className="panel table-panel">
      <div className="panel-heading internal-panel-heading">
        <div><h2>Daftar paket</h2><p>Teks pemasaran paket berasal dari katalog di repositori; paket di luar katalog memakai ringkasan kuota otomatis di halaman harga.</p></div>
        <span className="internal-count">{items.length.toLocaleString("id-ID")} total</span>
      </div>
      <div className="data-table internal-table">
        <div className="data-row data-head data-row--5"><span>Paket</span><span>Harga</span><span>Kuota</span><span>Langganan</span><span>Aksi</span></div>
        {items.length === 0 && <div className="data-row table-empty-row data-row--5"><span>Belum ada paket. Tambahkan paket pertama atau jalankan npm run db:plans.</span></div>}
        {items.map(plan => (
          <div className="data-row data-row--5" key={plan.id}>
            <span data-label="Paket">
              <strong>{plan.name}</strong><br />
              <small><code>{plan.code}</code>{plan.isActive ? "" : " · tidak aktif"}{plan.inCatalog ? "" : " · di luar katalog"}</small>
            </span>
            <span data-label="Harga">{formatRupiah(plan.monthlyPrice)}</span>
            <span data-label="Kuota">
              {limitText(plan.keywordLimit)} kata kunci · tiap {plan.searchIntervalHours} jam<br />
              <small>{limitText(plan.monthlySearchLimit)} pencarian · {limitText(plan.monthlyReplyLimit)} balasan · jadwal penuh {plan.projectedMonthlySearches.toLocaleString("id-ID")}</small>
              {plan.quotaIssues.length > 0 && <><br /><small className="plan-warning"><AlertTriangle size={13} /> {plan.quotaIssues[0]}</small></>}
            </span>
            <span data-label="Langganan">{plan.subscriptions.toLocaleString("id-ID")}</span>
            <span data-label="Aksi" className="row-actions">
              <button className="button button--ghost button--small" type="button" onClick={() => openEdit(plan)}><Pencil size={15} /> Ubah</button>
            </span>
          </div>
        ))}
      </div>
    </section>
  </>;
}
