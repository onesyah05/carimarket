"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, BadgeCheck, Check, ClipboardCopy, Clock, Receipt, X } from "lucide-react";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { BillingOverview, BillingTransaction } from "@/server/billing/transactions";

/**
 * Pusat upgrade paket untuk pengguna.
 *
 * Pembayaran diverifikasi manual, jadi antarmuka ini sengaja menonjolkan dua
 * hal yang menentukan keberhasilan verifikasi: nominal harus ditransfer sampai
 * tiga angka terakhir, dan tagihan hanya berlaku dalam jendela pembayaran.
 */

type Draft = { planId: string; periodMonths: number; paymentMethodId: string };

function periodLabel(months: number) {
  return months === 1 ? "1 bulan" : `${months} bulan`;
}

export function UpgradeCenter({ initial }: { initial: BillingOverview }) {
  const [overview, setOverview] = useState(initial);
  const [draft, setDraft] = useState<Draft>({
    planId: initial.options.find(option => !option.current)?.id ?? initial.options[0]?.id ?? "",
    periodMonths: initial.periodChoices[0] ?? 1,
    paymentMethodId: initial.paymentMethods[0]?.id ?? "",
  });
  const [payer, setPayer] = useState({ payerName: "", payerNote: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [copied, setCopied] = useState<string>();

  const open = overview.openTransaction;
  const selectedPlan = overview.options.find(option => option.id === draft.planId) ?? null;
  const projectedTotal = selectedPlan ? selectedPlan.monthlyPrice * draft.periodMonths : 0;

  async function send(url: string, body: unknown, method: "POST" | "PATCH", successMessage: string) {
    setBusy(true);
    setError(undefined);
    setSaved(undefined);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { data?: BillingOverview; error?: string } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error ?? "Permintaan belum dapat diproses.");
      setOverview(payload.data);
      setSaved(successMessage);
      setPayer({ payerName: "", payerNote: "" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Permintaan belum dapat diproses.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      window.setTimeout(() => setCopied(current => (current === field ? undefined : current)), 2_000);
    } catch {
      // Papan klip dapat ditolak peramban; nilainya tetap terlihat untuk disalin manual.
    }
  }

  function createInvoice(event: FormEvent) {
    event.preventDefault();
    void send("/api/billing/transactions", draft, "POST", "Tagihan dibuat. Ikuti instruksi pembayaran di bawah.");
  }

  function confirmPaid(event: FormEvent) {
    event.preventDefault();
    if (!open) return;
    void send(`/api/billing/transactions/${encodeURIComponent(open.id)}`, { action: "confirm", ...payer }, "PATCH", "Konfirmasi terkirim. Tim akan memverifikasi mutasi pembayaran Anda.");
  }

  function cancelInvoice() {
    if (!open) return;
    void send(`/api/billing/transactions/${encodeURIComponent(open.id)}`, { action: "cancel" }, "PATCH", "Tagihan dibatalkan.");
  }

  return <section className="panel upgrade-panel">
    <div className="panel-heading">
      <div>
        <h2>Upgrade paket</h2>
        <p>{open
          ? "Selesaikan tagihan berjalan di bawah. Satu akun hanya dapat memiliki satu tagihan terbuka."
          : "Pilih paket dan durasi, lalu bayar ke salah satu metode yang tersedia. Kuota baru berlaku setelah pembayaran diverifikasi."}</p>
      </div>
    </div>

    {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
    {saved && <p className="form-feedback form-feedback--success" role="status">{saved}</p>}

    {open
      ? <Invoice transaction={open} busy={busy} copied={copied} payer={payer} windowHours={overview.paymentWindowHours}
        onCopy={copy} onPayerChange={setPayer} onConfirm={confirmPaid} onCancel={cancelInvoice} />
      : overview.options.length === 0
        ? <p className="billing-empty">Belum ada paket berbayar yang aktif. Hubungi tim melalui halaman kontak untuk kebutuhan khusus.</p>
        : <form className="upgrade-form" onSubmit={createInvoice}>
          <div className="upgrade-options" role="radiogroup" aria-label="Pilih paket">
            {overview.options.map(option => <label key={option.id} className={`upgrade-option ${draft.planId === option.id ? "upgrade-option--active" : ""}`}>
              <input type="radio" name="plan" value={option.id} checked={draft.planId === option.id} onChange={() => { setDraft(current => ({ ...current, planId: option.id })); setError(undefined); }} disabled={busy} />
              <span className="upgrade-option__body">
                <strong>{option.name}{option.current && <em className="upgrade-badge">Paket Anda</em>}</strong>
                <span className="upgrade-option__price">{formatRupiah(option.monthlyPrice)} <small>/ bulan</small></span>
                <ul>{option.highlights.slice(0, 3).map(item => <li key={item}><Check size={14} /> {item}</li>)}</ul>
              </span>
            </label>)}
          </div>

          <div className="upgrade-fields">
            <div className="field">
              <label htmlFor="billing-period">Durasi</label>
              <select className="input" id="billing-period" value={draft.periodMonths} onChange={event => setDraft(current => ({ ...current, periodMonths: Number(event.target.value) }))} disabled={busy}>
                {overview.periodChoices.map(months => <option key={months} value={months}>{periodLabel(months)}</option>)}
              </select>
              <small className="field-hint">Perpanjangan paket yang sama menambah masa aktif, sisa periode tidak hangus.</small>
            </div>

            <div className="field">
              <label htmlFor="billing-method">Metode pembayaran</label>
              {overview.paymentMethods.length === 0
                ? <p className="billing-empty">Metode pembayaran belum disiapkan tim. Hubungi dukungan untuk mengaktifkan paket secara manual.</p>
                : <select className="input" id="billing-method" value={draft.paymentMethodId} onChange={event => setDraft(current => ({ ...current, paymentMethodId: event.target.value }))} disabled={busy}>
                  {overview.paymentMethods.map(method => <option key={method.id} value={method.id}>{method.channelLabel} · {method.label}</option>)}
                </select>}
            </div>
          </div>

          <div className="upgrade-total">
            <span>Perkiraan tagihan</span>
            <strong>{formatRupiah(projectedTotal)}</strong>
            <small>{selectedPlan ? `${selectedPlan.name}, ${periodLabel(draft.periodMonths)}. Kode unik tiga digit ditambahkan saat tagihan dibuat agar mutasi mudah dicocokkan.` : "Pilih paket terlebih dahulu."}</small>
          </div>

          <div className="settings-actions">
            <button className="button button--primary" type="submit" disabled={busy || !draft.planId || overview.paymentMethods.length === 0}>
              {busy ? "Membuat tagihan..." : "Buat tagihan"}
            </button>
          </div>
        </form>}

    {overview.history.length > 0 && <div className="billing-history">
      <h3><Receipt size={16} /> Riwayat transaksi</h3>
      <div className="data-table">
        <div className="data-row data-head data-row--4"><span>Tagihan</span><span>Paket</span><span>Nominal</span><span>Status</span></div>
        {overview.history.map(item => <div className="data-row data-row--4" key={item.id}>
          <span data-label="Tagihan"><code>{item.invoiceNumber}</code><br /><small>{formatDateTime(item.createdAt)}</small></span>
          <span data-label="Paket">{item.planName}<br /><small>{periodLabel(item.periodMonths)}</small></span>
          <span data-label="Nominal">{formatRupiah(item.totalAmount)}</span>
          <span data-label="Status"><StatusBadge transaction={item} /></span>
        </div>)}
      </div>
    </div>}
  </section>;
}

function StatusBadge({ transaction }: { transaction: BillingTransaction }) {
  const tone = transaction.status === "PAID"
    ? "pay-badge--ok"
    : transaction.status === "REJECTED"
      ? "pay-badge--error"
      : transaction.open ? "pay-badge--warn" : "pay-badge--muted";
  return <span className={`pay-badge ${tone}`}>{transaction.statusLabel}</span>;
}

function Invoice({ transaction, busy, copied, payer, windowHours, onCopy, onPayerChange, onConfirm, onCancel }: {
  transaction: BillingTransaction;
  busy: boolean;
  copied: string | undefined;
  payer: { payerName: string; payerNote: string };
  windowHours: number;
  onCopy: (value: string, field: string) => Promise<void>;
  onPayerChange: (value: { payerName: string; payerNote: string }) => void;
  onConfirm: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  const method = transaction.paymentMethod;
  const waiting = transaction.status === "REVIEW";

  return <div className="invoice">
    <div className="invoice__head">
      <div>
        <span>Tagihan <code>{transaction.invoiceNumber}</code></span>
        <strong>{transaction.planName} · {periodLabel(transaction.periodMonths)}</strong>
      </div>
      <span className={`pay-badge ${waiting ? "pay-badge--warn" : "pay-badge--ok"}`}>{transaction.statusLabel}</span>
    </div>

    <div className="invoice__amount">
      <span>Nominal transfer</span>
      <strong>{formatRupiah(transaction.totalAmount)}</strong>
      <button className="button button--ghost button--small" type="button" onClick={() => void onCopy(String(transaction.totalAmount), "amount")}>
        <ClipboardCopy size={15} /> {copied === "amount" ? "Tersalin" : "Salin nominal"}
      </button>
      <small>{formatRupiah(transaction.baseAmount)} harga paket + {transaction.uniqueCode} kode unik</small>
    </div>

    <p className="invoice__warning"><AlertTriangle size={15} /> Transfer tepat sampai tiga angka terakhir. Kode unik itulah yang membuat pembayaran Anda dikenali otomatis pada mutasi.</p>

    {method
      ? <dl className="invoice__method">
        <div><dt>Metode</dt><dd>{method.channelLabel} · {method.label}</dd></div>
        <div><dt>{method.channel === "QRIS" ? "Keterangan" : "Nomor tujuan"}</dt><dd>
          <span className="invoice__account">{method.accountNumber}</span>
          <button className="button button--ghost button--small" type="button" onClick={() => void onCopy(method.accountNumber, "account")}>
            <ClipboardCopy size={14} /> {copied === "account" ? "Tersalin" : "Salin"}
          </button>
        </dd></div>
        <div><dt>Atas nama</dt><dd>{method.accountName}</dd></div>
        {method.instructions && <div><dt>Catatan</dt><dd>{method.instructions}</dd></div>}
      </dl>
      : <p className="billing-empty">Metode pembayaran tagihan ini sudah dihapus tim. Batalkan tagihan lalu buat ulang dengan metode yang tersedia.</p>}

    <p className="invoice__expiry"><Clock size={15} /> {waiting
      ? `Konfirmasi terkirim ${formatDateTime(transaction.submittedAt)}. Verifikasi dilakukan manual oleh tim, biasanya dalam 1x24 jam kerja.`
      : `Bayar sebelum ${formatDateTime(transaction.expiresAt)}. Tagihan yang belum dibayar dalam ${windowHours} jam otomatis kedaluwarsa.`}</p>

    {waiting
      ? <div className="invoice__actions">
        <p><BadgeCheck size={15} /> Pembayaran atas nama {transaction.payerName ?? "—"} sedang diperiksa.</p>
        <button className="button button--ghost" type="button" onClick={onCancel} disabled={busy}><X size={15} /> Batalkan tagihan</button>
      </div>
      : <form className="invoice__confirm" onSubmit={onConfirm}>
        <h3>Sudah transfer?</h3>
        <p>Isi nama pengirim seperti yang tertulis di rekening Anda agar tim dapat mencocokkannya dengan mutasi.</p>
        <div className="field">
          <label htmlFor="payer-name">Nama pengirim</label>
          <input className="input" id="payer-name" value={payer.payerName} onChange={event => onPayerChange({ ...payer, payerName: event.target.value })} minLength={2} maxLength={120} disabled={busy} required />
        </div>
        <div className="field">
          <label htmlFor="payer-note">Catatan (opsional)</label>
          <input className="input" id="payer-note" value={payer.payerNote} onChange={event => onPayerChange({ ...payer, payerNote: event.target.value })} maxLength={500} placeholder="Mis. transfer dari BCA pukul 14.20" disabled={busy} />
        </div>
        <div className="invoice__actions">
          <button className="button button--primary" type="submit" disabled={busy}>{busy ? "Mengirim..." : "Saya sudah transfer"}</button>
          <button className="button button--ghost" type="button" onClick={onCancel} disabled={busy}><X size={15} /> Batalkan tagihan</button>
        </div>
      </form>}
  </div>;
}
