"use client";

import { FormEvent, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { AdminPaymentMethod } from "@/server/billing/payment-methods";

/**
 * Pengelolaan metode pembayaran oleh Superadmin.
 *
 * Isi form ini tampil apa adanya sebagai instruksi transfer kepada pelanggan,
 * jadi nomor rekening dan nama pemilik ditampilkan penuh di sini, bukan
 * disamarkan: Superadmin perlu memeriksa kebenarannya.
 */

type FormState = {
  channel: AdminPaymentMethod["channel"];
  label: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  isActive: boolean;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  channel: "BANK_TRANSFER",
  label: "",
  accountName: "",
  accountNumber: "",
  instructions: "",
  isActive: true,
  sortOrder: "0",
};

const CHANNELS: Array<{ value: FormState["channel"]; label: string; numberLabel: string; numberHint: string }> = [
  { value: "BANK_TRANSFER", label: "Transfer bank", numberLabel: "Nomor rekening", numberHint: "Mis. 1234567890" },
  { value: "EWALLET", label: "E-wallet", numberLabel: "Nomor e-wallet", numberHint: "Mis. 081234567890" },
  { value: "QRIS", label: "QRIS", numberLabel: "Keterangan QRIS", numberHint: "Mis. Scan QRIS Cari Market pada lampiran" },
];

function toForm(method: AdminPaymentMethod): FormState {
  return {
    channel: method.channel,
    label: method.label,
    accountName: method.accountName,
    accountNumber: method.accountNumber,
    instructions: method.instructions ?? "",
    isActive: method.isActive,
    sortOrder: String(method.sortOrder),
  };
}

export function PaymentMethodsManager({ methods }: { methods: AdminPaymentMethod[] }) {
  const [items, setItems] = useState(methods);
  const [mode, setMode] = useState<{ kind: "closed" } | { kind: "create" } | { kind: "edit"; method: AdminPaymentMethod }>({ kind: "closed" });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();

  const channel = CHANNELS.find(entry => entry.value === form.channel) ?? CHANNELS[0];

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
      const response = await fetch(creating ? "/api/admin/payment-methods" : `/api/admin/payment-methods/${encodeURIComponent(mode.method.id)}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: form.channel,
          label: form.label.trim(),
          accountName: form.accountName.trim(),
          accountNumber: form.accountNumber.trim(),
          instructions: form.instructions.trim(),
          isActive: form.isActive,
          sortOrder: Number(form.sortOrder) || 0,
        }),
      });
      const payload = await response.json().catch(() => null) as { data?: AdminPaymentMethod[]; error?: string } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error ?? "Metode pembayaran belum dapat disimpan.");
      setItems(payload.data);
      setSaved(creating ? `Metode ${form.label} ditambahkan.` : `Metode ${form.label} diperbarui.`);
      setMode({ kind: "closed" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Metode pembayaran belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(method: AdminPaymentMethod) {
    setError(undefined);
    setSaved(undefined);
    const response = await fetch(`/api/admin/payment-methods/${encodeURIComponent(method.id)}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null) as { data?: AdminPaymentMethod[]; error?: string } | null;
    if (!response.ok || !payload?.data) {
      setError(payload?.error ?? "Metode pembayaran belum dapat dihapus.");
      return;
    }
    setItems(payload.data);
    setSaved(`Metode ${method.label} dihapus.`);
    if (mode.kind === "edit" && mode.method.id === method.id) setMode({ kind: "closed" });
  }

  return <>
    <div className="plans-actions">
      <button className="button button--primary" type="button" onClick={() => { setForm(EMPTY_FORM); setMode({ kind: "create" }); setError(undefined); setSaved(undefined); }}>
        <Plus size={16} /> Tambah metode
      </button>
      {saved && <span className="form-feedback form-feedback--success" role="status">{saved}</span>}
      {error && <span className="form-feedback form-feedback--error" role="alert">{error}</span>}
    </div>

    {mode.kind !== "closed" && <section className="panel plan-form-panel">
      <div className="panel-heading internal-panel-heading">
        <div>
          <h2>{mode.kind === "create" ? "Metode pembayaran baru" : `Ubah ${mode.method.label}`}</h2>
          <p>Nomor dan nama pemilik akun ini tampil apa adanya kepada pelanggan sebagai instruksi transfer. Periksa ketikannya sebelum menyimpan.</p>
        </div>
        <button className="icon-button" type="button" aria-label="Tutup form" onClick={() => { setMode({ kind: "closed" }); setError(undefined); }}><X size={18} /></button>
      </div>

      <form className="plan-form" onSubmit={event => void submit(event)}>
        <div className="field">
          <label htmlFor="method-channel">Saluran</label>
          <select className="input" id="method-channel" value={form.channel} onChange={event => update("channel", event.target.value)} disabled={busy}>
            {CHANNELS.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="method-label">Nama metode</label>
          <input className="input" id="method-label" value={form.label} onChange={event => update("label", event.target.value)} placeholder="BCA" minLength={2} maxLength={80} disabled={busy} required />
        </div>
        <div className="field">
          <label htmlFor="method-number">{channel.numberLabel}</label>
          <input className="input" id="method-number" value={form.accountNumber} onChange={event => update("accountNumber", event.target.value)} placeholder={channel.numberHint} minLength={2} maxLength={80} disabled={busy} required />
        </div>
        <div className="field">
          <label htmlFor="method-account-name">Atas nama</label>
          <input className="input" id="method-account-name" value={form.accountName} onChange={event => update("accountName", event.target.value)} placeholder="PT Cari Market Indonesia" minLength={2} maxLength={120} disabled={busy} required />
        </div>
        <div className="field">
          <label htmlFor="method-order">Urutan tampil</label>
          <input className="input" id="method-order" type="number" min="0" max="999" value={form.sortOrder} onChange={event => update("sortOrder", event.target.value)} disabled={busy} required />
          <small className="field-hint">Angka kecil tampil lebih dulu pada pilihan pelanggan.</small>
        </div>
        <div className="field plan-form__toggle">
          <label htmlFor="method-instructions">Catatan untuk pelanggan (opsional)</label>
          <textarea className="input" id="method-instructions" rows={2} value={form.instructions} onChange={event => update("instructions", event.target.value)} maxLength={1000} placeholder="Mis. transfer dari bank lain dikenai biaya admin yang ditanggung pengirim." disabled={busy} />
        </div>
        <label className="safety-toggle plan-form__toggle">
          <input type="checkbox" checked={form.isActive} onChange={event => update("isActive", event.target.checked)} disabled={busy} />
          <span><strong>Metode aktif</strong><small>Metode aktif dapat dipilih pelanggan saat membuat tagihan.</small></span>
        </label>

        {error && <p className="form-feedback form-feedback--error plan-form__feedback" role="alert">{error}</p>}
        <div className="plan-form__actions">
          <button className="button button--primary" type="submit" disabled={busy}>{busy ? "Menyimpan..." : mode.kind === "create" ? "Tambah metode" : "Simpan perubahan"}</button>
          <button className="button button--ghost" type="button" onClick={() => setMode({ kind: "closed" })} disabled={busy}>Batal</button>
        </div>
      </form>
    </section>}

    <section className="panel table-panel">
      <div className="panel-heading internal-panel-heading">
        <div><h2>Metode pembayaran</h2><p>Tujuan transfer yang dipakai pelanggan untuk membayar tagihan upgrade.</p></div>
        <span className="internal-count">{items.length.toLocaleString("id-ID")} total</span>
      </div>
      <div className="data-table internal-table">
        <div className="data-row data-head data-row--4"><span>Metode</span><span>Tujuan</span><span>Tagihan</span><span>Aksi</span></div>
        {items.length === 0 && <div className="data-row table-empty-row data-row--4"><span>Belum ada metode pembayaran. Pelanggan belum dapat membuat tagihan upgrade sampai minimal satu metode aktif ditambahkan.</span></div>}
        {items.map(method => <div className="data-row data-row--4" key={method.id}>
          <span data-label="Metode">
            <strong>{method.label}</strong><br />
            <small>{method.channelLabel}{method.isActive ? "" : " · tidak aktif"} · urutan {method.sortOrder}</small>
          </span>
          <span data-label="Tujuan">
            {method.accountNumber}<br />
            <small>{method.accountName}</small>
          </span>
          <span data-label="Tagihan">{method.transactions.toLocaleString("id-ID")}</span>
          <span data-label="Aksi" className="row-actions">
            <button className="button button--ghost button--small" type="button" onClick={() => { setForm(toForm(method)); setMode({ kind: "edit", method }); setError(undefined); setSaved(undefined); }}><Pencil size={15} /> Ubah</button>
            {method.transactions === 0 && <button className="button button--danger button--small" type="button" onClick={() => void remove(method)}><Trash2 size={15} /> Hapus</button>}
          </span>
        </div>)}
      </div>
    </section>
  </>;
}
