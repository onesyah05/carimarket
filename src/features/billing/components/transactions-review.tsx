"use client";

import { useState } from "react";
import { BadgeCheck, XCircle } from "lucide-react";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { AdminTransaction, AdminTransactionList } from "@/server/billing/transactions";

/**
 * Antrean verifikasi pembayaran.
 *
 * Nominal ditampilkan utuh beserta kode uniknya karena itulah yang dicocokkan
 * dengan mutasi rekening. Menyetujui langsung mengaktifkan paket pelanggan,
 * jadi tombolnya meminta konfirmasi dan setiap keputusan tercatat di audit log.
 */

type Decision = { id: string; action: "approve" | "reject" };

export function TransactionsReview({ initial }: { initial: AdminTransactionList }) {
  const [list, setList] = useState(initial);
  const [pending, setPending] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();

  async function decide(decision: Decision, reviewNote: string) {
    setBusy(true);
    setError(undefined);
    setSaved(undefined);
    try {
      const response = await fetch(`/api/admin/transactions/${encodeURIComponent(decision.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: decision.action, note: reviewNote.trim() }),
      });
      const payload = await response.json().catch(() => null) as { data?: AdminTransactionList; error?: string } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error ?? "Keputusan belum dapat disimpan.");
      setList(payload.data);
      setSaved(decision.action === "approve" ? "Pembayaran diverifikasi dan paket pelanggan sudah aktif." : "Pembayaran ditolak dan pelanggan sudah diberi tahu.");
      setPending(null);
      setNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Keputusan belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <section className="stat-grid">
      <article className="stat-card"><span>Menunggu verifikasi</span><strong>{list.counts.review}</strong><p>{list.counts.review > 0 ? "Pelanggan sudah mengaku membayar" : "Antrean bersih"}</p></article>
      <article className="stat-card"><span>Menunggu pembayaran</span><strong>{list.counts.pending}</strong><p>Tagihan terbuka yang belum dibayar</p></article>
      <article className="stat-card"><span>Lunas bulan ini</span><strong>{list.counts.paidThisMonth}</strong><p>Dihitung dari tanggal verifikasi</p></article>
      <article className="stat-card"><span>Nilai terverifikasi</span><strong>{formatRupiah(list.counts.revenueThisMonth)}</strong><p>Total nominal lunas bulan ini</p></article>
    </section>

    {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
    {saved && <p className="form-feedback form-feedback--success" role="status">{saved}</p>}

    {pending && <section className="panel mini-form-panel">
      <strong>{pending.action === "approve" ? "Setujui pembayaran" : "Tolak pembayaran"}</strong>
      <p>{pending.action === "approve"
        ? "Pastikan nominal beserta tiga angka kode unik benar-benar ada di mutasi. Menyetujui langsung mengaktifkan paket dan memperpanjang masa aktif pelanggan."
        : "Alasan di bawah dikirim ke pelanggan sebagai notifikasi, jadi tuliskan hal yang dapat mereka tindak lanjuti."}</p>
      <div className="field">
        <label htmlFor="review-note">{pending.action === "approve" ? "Catatan verifikasi (opsional)" : "Alasan penolakan"}</label>
        <textarea className="input" id="review-note" rows={2} value={note} onChange={event => setNote(event.target.value)} maxLength={500} placeholder={pending.action === "approve" ? "Mis. cocok dengan mutasi BCA 11 Oktober 14.22" : "Mis. nominal tidak sesuai, kode unik 417 tidak ditemukan"} disabled={busy} />
      </div>
      <div className="plan-form__actions">
        <button className={`button ${pending.action === "approve" ? "button--primary" : "button--danger"}`} type="button" disabled={busy || (pending.action === "reject" && note.trim().length < 3)} onClick={() => void decide(pending, note)}>
          {busy ? "Menyimpan..." : pending.action === "approve" ? "Ya, aktifkan paket" : "Ya, tolak pembayaran"}
        </button>
        <button className="button button--ghost" type="button" onClick={() => { setPending(null); setNote(""); }} disabled={busy}>Batal</button>
      </div>
    </section>}

    <section className="panel table-panel">
      <div className="panel-heading internal-panel-heading">
        <div><h2>Transaksi</h2><p>100 tagihan terbaru. Nominal sudah termasuk kode unik yang dipakai mencocokkan mutasi.</p></div>
        <span className="internal-count">{list.transactions.length.toLocaleString("id-ID")} tampil</span>
      </div>
      <div className="data-table internal-table">
        <div className="data-row data-head data-row--5"><span>Tagihan</span><span>Pelanggan</span><span>Paket</span><span>Nominal</span><span>Status</span></div>
        {list.transactions.length === 0 && <div className="data-row table-empty-row data-row--5"><span>Belum ada transaksi. Tagihan muncul di sini setelah pelanggan memilih paket dari dashboard mereka.</span></div>}
        {list.transactions.map(transaction => <Row key={transaction.id} transaction={transaction} busy={busy} onDecide={action => { setPending({ id: transaction.id, action }); setNote(""); setError(undefined); setSaved(undefined); }} />)}
      </div>
    </section>
  </>;
}

function Row({ transaction, busy, onDecide }: { transaction: AdminTransaction; busy: boolean; onDecide: (action: "approve" | "reject") => void }) {
  const tone = transaction.status === "PAID"
    ? "pay-badge--ok"
    : transaction.status === "REJECTED"
      ? "pay-badge--error"
      : transaction.open ? "pay-badge--warn" : "pay-badge--muted";

  return <div className="data-row data-row--5">
    <span data-label="Tagihan">
      <code>{transaction.invoiceNumber}</code><br />
      <small>{formatDateTime(transaction.createdAt)}</small>
    </span>
    <span data-label="Pelanggan">
      {transaction.user.name}<br />
      <small>{transaction.user.email}</small>
      {transaction.payerName && <><br /><small>Pengirim: {transaction.payerName}</small></>}
      {transaction.payerNote && <><br /><small>{transaction.payerNote}</small></>}
    </span>
    <span data-label="Paket">
      {transaction.planName}<br />
      <small>{transaction.periodMonths} bulan · {transaction.paymentMethod ? `${transaction.paymentMethod.channelLabel} ${transaction.paymentMethod.label}` : "metode dihapus"}</small>
    </span>
    <span data-label="Nominal">
      <strong>{formatRupiah(transaction.totalAmount)}</strong><br />
      <small>kode unik {transaction.uniqueCode}</small>
    </span>
    <span data-label="Status" className="row-actions">
      <span className={`pay-badge ${tone}`}>{transaction.statusLabel}</span>
      {transaction.open && <>
        <button className="button button--primary button--small" type="button" onClick={() => onDecide("approve")} disabled={busy}><BadgeCheck size={15} /> Setujui</button>
        <button className="button button--danger button--small" type="button" onClick={() => onDecide("reject")} disabled={busy}><XCircle size={15} /> Tolak</button>
      </>}
      {transaction.reviewedBy && <small>oleh {transaction.reviewedBy}</small>}
      {transaction.reviewNote && <small>{transaction.reviewNote}</small>}
    </span>
  </div>;
}
