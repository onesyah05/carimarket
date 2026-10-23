"use client";

import { RichTextEditor } from "@/components/rich-text-editor";
import { FormEvent, useCallback, useState } from "react";
import { Image as ImageIcon, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { FormModal } from "@/components/form-modal";
import type { AdminPaymentMethod } from "@/server/billing/payment-methods";

/**
 * Pengelolaan metode pembayaran oleh Superadmin.
 *
 * Isi form ini tampil apa adanya sebagai instruksi transfer kepada pelanggan,
 * jadi nomor rekening dan nama pemilik ditampilkan penuh di sini, bukan
 * disamarkan: Superadmin perlu memeriksa kebenarannya.
 *
 * Dikirim sebagai FormData, bukan JSON, karena metode QRIS dan gambarnya harus
 * tersimpan dalam satu tindakan: QRIS yang aktif tanpa gambar tidak menyisakan
 * apa pun untuk dibayar, jadi keadaan itu tidak boleh sempat ada.
 */

/** Saluran yang masih boleh dibuat. Lihat catatan pada CHANNELS. */
type Channel = "QRIS" | "EWALLET";

type FormState = {
  channel: Channel;
  label: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  isActive: boolean;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  // QRIS lebih dulu karena itulah cara bayar utamanya sekarang.
  channel: "QRIS",
  label: "",
  accountName: "",
  accountNumber: "",
  instructions: "",
  isActive: true,
  sortOrder: "0",
};

/**
 * Transfer bank sengaja tidak ada di sini.
 *
 * Nilainya tetap hidup di basis data supaya tagihan lama yang memakainya masih
 * terbaca di histori; yang berhenti hanyalah pembuatan metode bank yang baru.
 */
const CHANNELS: Array<{ value: Channel; label: string; numberLabel: string; numberHint: string }> = [
  { value: "QRIS", label: "QRIS", numberLabel: "NMID (opsional)", numberHint: "Mis. ID1026622753196" },
  { value: "EWALLET", label: "E-wallet", numberLabel: "Nomor e-wallet", numberHint: "Mis. 081234567890" },
];

/** Metode bertsaluran lama (transfer bank) tidak dapat diubah lagi, hanya dihapus. */
function isEditable(method: AdminPaymentMethod) {
  return CHANNELS.some(entry => entry.value === method.channel);
}

function toForm(method: AdminPaymentMethod): FormState {
  return {
    channel: isEditable(method) ? method.channel as Channel : "QRIS",
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
  // Berkas disimpan terpisah dari FormState: ia tidak pernah datang dari
  // server, dan membiarkannya di sana membuat "belum memilih berkas baru"
  // tercampur dengan "gambar lama dihapus".
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();

  const channel = CHANNELS.find(entry => entry.value === form.channel) ?? CHANNELS[0];
  const isQris = form.channel === "QRIS";
  const existingQr = mode.kind === "edit" ? mode.method.qrImageUrl : null;
  // Menutup saat penyimpanan berjalan akan menyembunyikan hasilnya, jadi
  // tombol tutup, Escape, dan klik latar sama-sama menunggu proses selesai.
  const close = useCallback(() => {
    if (busy) return;
    setMode({ kind: "closed" });
    setError(undefined);
  }, [busy]);

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
      const body = new FormData();
      body.set("channel", form.channel);
      body.set("label", form.label.trim());
      body.set("accountName", form.accountName.trim());
      body.set("accountNumber", form.accountNumber.trim());
      body.set("instructions", form.instructions.trim());
      body.set("isActive", String(form.isActive));
      body.set("sortOrder", String(Number(form.sortOrder) || 0));
      // Tanpa berkas baru, medannya tidak dikirim sama sekali dan gambar yang
      // sudah tersimpan dibiarkan apa adanya.
      if (file) body.set("qris", file);

      // Content-Type sengaja tidak disetel: peramban yang menuliskannya
      // lengkap dengan boundary multipart.
      const response = await fetch(creating ? "/api/admin/payment-methods" : `/api/admin/payment-methods/${encodeURIComponent(mode.method.id)}`, {
        method: creating ? "POST" : "PATCH",
        body,
      });
      const payload = await response.json().catch(() => null) as { data?: AdminPaymentMethod[]; error?: string } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error ?? "Metode pembayaran belum dapat disimpan.");
      setItems(payload.data);
      setSaved(creating ? `Metode ${form.label} ditambahkan.` : `Metode ${form.label} diperbarui.`);
      setFile(null);
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
      <button className="button button--primary" type="button" onClick={() => { setForm(EMPTY_FORM); setFile(null); setMode({ kind: "create" }); setError(undefined); setSaved(undefined); }}>
        <Plus size={16} /> Tambah metode
      </button>
      {saved && <span className="form-feedback form-feedback--success" role="status">{saved}</span>}
      {error && <span className="form-feedback form-feedback--error" role="alert">{error}</span>}
    </div>

    {mode.kind !== "closed" && <FormModal
      title={mode.kind === "create" ? "Metode pembayaran baru" : `Ubah ${mode.method.label}`}
      description="Nomor dan nama pemilik akun ini tampil apa adanya kepada pelanggan sebagai instruksi transfer. Periksa ketikannya sebelum menyimpan."
      busy={busy}
      onClose={close}
    >
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
            {/* Pada QRIS yang dibayar adalah gambarnya, bukan sebuah nomor,
                jadi isian ini tidak diwajibkan di sana. Memaksanya hanya
                membuat isian karangan yang tampil apa adanya ke pelanggan. */}
            <input className="input" id="method-number" value={form.accountNumber} onChange={event => update("accountNumber", event.target.value)} placeholder={channel.numberHint} minLength={isQris ? 0 : 2} maxLength={80} disabled={busy} required={!isQris} />
          </div>

          {isQris && <div className="field qr-field">
            <label htmlFor="method-qris"><QrCode size={15} /> Gambar QRIS</label>
            {existingQr && !file && <div className="qr-field__current">
              {/* eslint-disable-next-line @next/next/no-img-element -- gambar dilayani route terautentikasi dengan ukuran yang tidak diketahui di muka. */}
              <img src={existingQr} alt={`QRIS ${mode.kind === "edit" ? mode.method.label : ""}`} />
              <small>Gambar yang terpasang sekarang. Pilih berkas baru hanya bila ingin menggantinya.</small>
            </div>}
            <input
              className="input qr-field__input"
              id="method-qris"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={event => { setFile(event.target.files?.[0] ?? null); setError(undefined); setSaved(undefined); }}
            />
            <small className="field-hint">
              {file ? `${file.name} siap dikirim. ` : ""}JPG, PNG, atau WebP maksimal 2 MB. Gambar inilah yang dipindai pelanggan, jadi metode QRIS yang aktif harus memilikinya.
            </small>
          </div>}
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
            <RichTextEditor id="method-instructions" rows={3} value={form.instructions} onChange={value => update("instructions", value)} maxLength={1000} />
          </div>
          <label className="safety-toggle plan-form__toggle">
            <input type="checkbox" checked={form.isActive} onChange={event => update("isActive", event.target.checked)} disabled={busy} />
            <span><strong>Metode aktif</strong><small>Metode aktif dapat dipilih pelanggan saat membuat tagihan.</small></span>
          </label>

          {error && <p className="form-feedback form-feedback--error plan-form__feedback" role="alert">{error}</p>}
          <div className="plan-form__actions">
            <button className="button button--primary" type="submit" disabled={busy}>{busy ? "Menyimpan..." : mode.kind === "create" ? "Tambah metode" : "Simpan perubahan"}</button>
            <button className="button button--ghost" type="button" onClick={close} disabled={busy}>Batal</button>
          </div>
        </form>
    </FormModal>}

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
            {method.qrImageUrl
              ? <a className="qr-chip" href={method.qrImageUrl} target="_blank" rel="noreferrer"><ImageIcon size={14} /> Lihat QRIS</a>
              : method.accountNumber || <em>—</em>}
            {method.qrImageUrl && method.accountNumber ? <><br />{method.accountNumber}</> : null}
            <br />
            <small>{method.accountName}</small>
          </span>
          <span data-label="Tagihan">{method.transactions.toLocaleString("id-ID")}</span>
          <span data-label="Aksi" className="row-actions">
            {isEditable(method)
              ? <button className="button button--ghost button--small" type="button" onClick={() => { setForm(toForm(method)); setFile(null); setMode({ kind: "edit", method }); setError(undefined); setSaved(undefined); }}><Pencil size={15} /> Ubah</button>
              : <small className="qr-legacy">Saluran lama, hanya dapat dihapus.</small>}
            {method.transactions === 0 && <button className="button button--danger button--small" type="button" onClick={() => void remove(method)}><Trash2 size={15} /> Hapus</button>}
          </span>
        </div>)}
      </div>
    </section>
  </>;
}
