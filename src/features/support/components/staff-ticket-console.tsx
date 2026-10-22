"use client";

import { useState } from "react";
import { Inbox, Lock, Send, UserCog } from "lucide-react";
import { formatDateTime, statusLabel } from "@/lib/format";
import type { InternalTicketSummary, TicketDetail } from "@/server/support/tickets";

/**
 * Konsol tiket untuk staf.
 *
 * Dulu panel ini hanya tabel: tiket terlihat tetapi tidak dapat dijawab, jadi
 * dukungan praktis berjalan di luar aplikasi. Sekarang daftar dan percakapan
 * berada di satu halaman, karena menjawab tiket berarti membaca riwayatnya
 * lebih dulu.
 *
 * Dua jenis kiriman dibedakan dengan tegas di antarmuka: balasan terlihat oleh
 * pengguna dan memicu notifikasi, catatan internal tidak. Keduanya tidak boleh
 * tertukar hanya karena tombolnya berdekatan.
 */

type Props = { tickets: InternalTicketSummary[] };

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"] as const;
const PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export function StaffTicketConsole({ tickets: initialTickets }: Props) {
  const [tickets, setTickets] = useState(initialTickets);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [internal, setInternal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(null);

  async function openTicket(id: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tickets?id=${encodeURIComponent(id)}`);
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "Tiket tidak dapat dibuka.");
        return;
      }
      setDetail(result.data as TicketDetail);
      setSentAt(null);
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: detail.id,
          body: data.get("body"),
          isInternal: internal,
          status: data.get("status"),
          priority: data.get("priority"),
          assignToMe: data.get("assignToMe") === "on",
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "Balasan belum terkirim. Silakan coba lagi.");
        return;
      }
      const updated = result.data as TicketDetail;
      setDetail(updated);
      setSentAt(new Date().toISOString());
      form.reset();
      setTickets(current => current.map(ticket => ticket.id === updated.id
        ? {
          ...ticket,
          status: updated.status,
          priority: updated.priority,
          assigneeName: updated.assigneeName,
          messageCount: updated.messageCount,
          updatedAt: updated.updatedAt,
          waitingOnStaff: internal ? ticket.waitingOnStaff : false,
        }
        : ticket));
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setPending(false);
    }
  }

  const waiting = tickets.filter(ticket => ticket.waitingOnStaff).length;

  return (
    <div className="support-center">
      <section className="panel support-list">
        <header className="panel-head">
          <div>
            <h2>Tiket dukungan</h2>
            <p>
              {tickets.length} tiket terbaru
              {waiting > 0 ? ` · ${waiting} menunggu jawaban tim` : " · tidak ada yang menunggu jawaban tim"}
            </p>
          </div>
        </header>

        {tickets.length === 0
          ? <p className="support-empty"><Inbox size={16} /> Belum ada tiket. Tiket dari pengguna akan muncul di sini.</p>
          : <ul className="support-ticket-list">
            {tickets.map(ticket => (
              <li key={ticket.id}>
                <button
                  type="button"
                  className={`support-ticket-row ${detail?.id === ticket.id ? "is-active" : ""} ${ticket.waitingOnStaff ? "is-waiting" : ""}`}
                  onClick={() => void openTicket(ticket.id)}
                  disabled={pending}
                >
                  <span className="support-ticket-subject">{ticket.subject}</span>
                  <span className={`support-badge support-badge--${ticket.waitingOnStaff ? "open" : "done"}`}>
                    {statusLabel(ticket.status)}
                  </span>
                  <span className="support-ticket-meta">
                    {ticket.requesterName}
                    {ticket.requesterEmail ? ` · ${ticket.requesterEmail}` : " · email placeholder"}
                    {` · prioritas ${statusLabel(ticket.priority)}`}
                    {ticket.assigneeName ? ` · ${ticket.assigneeName}` : " · belum ditugaskan"}
                    {` · ${formatDateTime(ticket.updatedAt)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {detail && (
        <section className="panel support-thread">
          <header className="panel-head">
            <div>
              <h2>{detail.subject}</h2>
              <p>
                {detail.requesterName}
                {detail.requesterEmail ? ` · ${detail.requesterEmail}` : " · tidak punya email yang dapat dihubungi"}
                {` · ${statusLabel(detail.status)}`}
              </p>
            </div>
          </header>

          <ol className="support-messages">
            {detail.messages.map(message => (
              <li
                key={message.id}
                className={`${message.fromStaff ? "is-staff" : "is-user"} ${message.isInternal ? "is-internal" : ""}`}
              >
                <p className="support-message-head">
                  {message.fromStaff ? <UserCog size={14} /> : null}
                  <strong>{message.authorName}</strong>
                  {message.isInternal && <span className="support-badge support-badge--internal"><Lock size={11} /> Catatan internal</span>}
                  <span>{formatDateTime(message.createdAt)}</span>
                </p>
                <p className="support-message-body">{message.body}</p>
              </li>
            ))}
          </ol>

          {sentAt && <p className="form-feedback form-feedback--success" role="status">Kiriman tersimpan {formatDateTime(sentAt)}.</p>}

          <form className="form-grid support-reply" onSubmit={submit}>
            <div className="support-reply-mode" role="group" aria-label="Jenis kiriman">
              <button
                type="button"
                className={`faq-pill-btn ${internal ? "" : "active"}`}
                onClick={() => setInternal(false)}
                aria-pressed={!internal}
                disabled={pending}
              >
                Balasan ke pengguna
              </button>
              <button
                type="button"
                className={`faq-pill-btn ${internal ? "active" : ""}`}
                onClick={() => setInternal(true)}
                aria-pressed={internal}
                disabled={pending}
              >
                <Lock size={13} /> Catatan internal
              </button>
            </div>

            <p className="support-hint">
              {internal
                ? "Catatan ini hanya terlihat oleh tim internal dan tidak mengirim notifikasi ke pengguna."
                : "Balasan ini terlihat oleh pengguna, memicu notifikasi, dan mengubah status menjadi menunggu pengguna."}
            </p>

            <div className="field">
              <label htmlFor="staff-body">{internal ? "Catatan" : "Balasan"}</label>
              <textarea
                className="input"
                id="staff-body"
                name="body"
                rows={5}
                minLength={2}
                maxLength={4000}
                placeholder={internal ? "Konteks penanganan untuk tim…" : "Tulis jawaban untuk pengguna…"}
                required
                disabled={pending}
              />
            </div>

            <div className="form-row support-reply-controls">
              <label className="field">
                <span>Status setelah dikirim</span>
                <select className="input" name="status" defaultValue={internal ? detail.status : "WAITING_USER"} disabled={pending}>
                  {STATUS_OPTIONS.map(option => <option key={option} value={option}>{statusLabel(option)}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Prioritas</span>
                <select className="input" name="priority" defaultValue={detail.priority} disabled={pending}>
                  {PRIORITY_OPTIONS.map(option => <option key={option} value={option}>{statusLabel(option)}</option>)}
                </select>
              </label>
              <label>
                <input type="checkbox" name="assignToMe" defaultChecked={detail.assigneeName === null} disabled={pending} /> Tugaskan ke saya
              </label>
            </div>

            <button className="button button--primary" type="submit" disabled={pending}>
              <Send size={16} /> {pending ? "Menyimpan…" : internal ? "Simpan catatan" : "Kirim balasan"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
