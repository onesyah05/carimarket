"use client";

import { useState } from "react";
import { CircleHelp, Lock, MessageSquarePlus, Send, UserCog } from "lucide-react";
import { formatDateTime, statusLabel } from "@/lib/format";
import type { TicketDetail, TicketSummary } from "@/server/support/tickets";

/**
 * Pusat bantuan pengguna.
 *
 * Satu halaman untuk tiga hal yang selalu berurutan: melihat tiket yang
 * berjalan, membuka tiket baru, dan melanjutkan percakapan. Memisahkannya ke
 * beberapa halaman hanya menambah klik pada orang yang sedang terhambat.
 */

type Props = { tickets: TicketSummary[]; emailReachable: boolean };

const CLOSED_STATUSES = new Set(["RESOLVED", "CLOSED"]);

export function SupportCenter({ tickets: initialTickets, emailReachable }: Props) {
  const [tickets, setTickets] = useState(initialTickets);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [composing, setComposing] = useState(initialTickets.length === 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function mergeSummary(updated: TicketDetail) {
    setDetail(updated);
    setTickets(current => {
      const summary: TicketSummary = {
        id: updated.id,
        subject: updated.subject,
        status: updated.status,
        priority: updated.priority,
        messageCount: updated.messageCount,
        lastMessageAt: updated.lastMessageAt,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
      const without = current.filter(ticket => ticket.id !== updated.id);
      return [summary, ...without];
    });
  }

  async function send(url: string, method: "POST" | "PATCH", payload?: unknown) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "Permintaan belum berhasil. Silakan coba lagi.");
        return null;
      }
      return result?.data as TicketDetail;
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function openTicket(id: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/support/tickets/${id}`);
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "Tiket tidak dapat dibuka.");
        return;
      }
      setDetail(result.data as TicketDetail);
      setComposing(false);
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setPending(false);
    }
  }

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const created = await send("/api/support/tickets", "POST", {
      subject: form.get("subject"),
      body: form.get("body"),
      priority: form.get("priority"),
    });
    if (created) {
      mergeSummary(created);
      setComposing(false);
    }
  }

  async function reply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    const updated = await send(`/api/support/tickets/${detail.id}`, "POST", { body });
    if (updated) {
      mergeSummary(updated);
      form.reset();
    }
  }

  async function closeTicket() {
    if (!detail) return;
    const updated = await send(`/api/support/tickets/${detail.id}`, "PATCH");
    if (updated) mergeSummary(updated);
  }

  return (
    <div className="support-center">
      {!emailReachable && (
        <p className="support-notice" role="status">
          <Lock size={15} /> Akun Anda terhubung lewat Threads dan belum punya email yang dapat dihubungi, jadi balasan tiket
          hanya tampil di halaman ini. Tambahkan email di Pengaturan agar ikut menerima pemberitahuan.
        </p>
      )}

      <section className="panel support-list">
        <header className="panel-head">
          <div>
            <h2>Tiket Anda</h2>
            <p>Percakapan dengan tim dukungan Cari Market.</p>
          </div>
          <button
            className="button button--ghost"
            type="button"
            onClick={() => { setComposing(true); setDetail(null); setError(null); }}
            disabled={pending}
          >
            <MessageSquarePlus size={16} /> Tiket baru
          </button>
        </header>

        {tickets.length === 0
          ? <p className="support-empty"><CircleHelp size={16} /> Belum ada tiket. Buka tiket baru dan jelaskan kendala Anda.</p>
          : <ul className="support-ticket-list">
            {tickets.map(ticket => (
              <li key={ticket.id}>
                <button
                  type="button"
                  className={`support-ticket-row ${detail?.id === ticket.id ? "is-active" : ""}`}
                  onClick={() => void openTicket(ticket.id)}
                  disabled={pending}
                >
                  <span className="support-ticket-subject">{ticket.subject}</span>
                  <span className={`support-badge support-badge--${CLOSED_STATUSES.has(ticket.status) ? "done" : "open"}`}>
                    {statusLabel(ticket.status)}
                  </span>
                  <span className="support-ticket-meta">
                    {ticket.messageCount} pesan · diperbarui {formatDateTime(ticket.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {composing && (
        <section className="panel support-compose">
          <h2>Buka tiket baru</h2>
          <form className="form-grid" onSubmit={createTicket}>
            <div className="field">
              <label htmlFor="subject">Judul singkat</label>
              <input className="input" id="subject" name="subject" minLength={5} maxLength={191} placeholder="Mis. Pencarian kata kunci tidak menghasilkan lead" required disabled={pending} />
            </div>
            <div className="field">
              <label htmlFor="priority">Tingkat urgensi</label>
              <select className="input" id="priority" name="priority" defaultValue="NORMAL" disabled={pending}>
                <option value="LOW">Rendah — pertanyaan umum</option>
                <option value="NORMAL">Normal — ada yang tidak sesuai harapan</option>
                <option value="HIGH">Tinggi — pekerjaan saya terhenti</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="body">Jelaskan kendalanya</label>
              <textarea
                className="input"
                id="body"
                name="body"
                rows={6}
                minLength={20}
                maxLength={4000}
                placeholder="Sebutkan apa yang Anda lakukan, apa yang terjadi, dan apa yang Anda harapkan. Sertakan nama kata kunci atau waktu kejadian bila ada."
                required
                disabled={pending}
              />
            </div>
            <button className="button button--primary" type="submit" disabled={pending}>
              {pending ? "Mengirim…" : "Kirim tiket"}
            </button>
          </form>
          <p className="support-hint">Jangan sertakan kata sandi atau token. Tim dukungan tidak pernah memintanya.</p>
        </section>
      )}

      {detail && (
        <section className="panel support-thread">
          <header className="panel-head">
            <div>
              <h2>{detail.subject}</h2>
              <p>
                {statusLabel(detail.status)} · prioritas {statusLabel(detail.priority)}
                {detail.assigneeName ? ` · ditangani ${detail.assigneeName}` : " · menunggu penugasan"}
              </p>
            </div>
            {!CLOSED_STATUSES.has(detail.status) && (
              <button className="button button--ghost" type="button" onClick={() => void closeTicket()} disabled={pending}>
                Tandai selesai
              </button>
            )}
          </header>

          <ol className="support-messages">
            {detail.messages.map(message => (
              <li key={message.id} className={message.fromStaff ? "is-staff" : "is-user"}>
                <p className="support-message-head">
                  {message.fromStaff ? <UserCog size={14} /> : null}
                  <strong>{message.fromStaff ? `${message.authorName} · Tim dukungan` : message.authorName}</strong>
                  <span>{formatDateTime(message.createdAt)}</span>
                </p>
                <p className="support-message-body">{message.body}</p>
              </li>
            ))}
          </ol>

          {detail.status === "CLOSED"
            ? <p className="support-hint">Tiket ini sudah ditutup. Buka tiket baru bila masih ada kendala.</p>
            : <form className="form-grid support-reply" onSubmit={reply}>
              <div className="field">
                <label htmlFor="reply-body">Balas</label>
                <textarea className="input" id="reply-body" name="body" rows={4} minLength={2} maxLength={4000} placeholder="Tulis balasan Anda…" required disabled={pending} />
              </div>
              <button className="button button--primary" type="submit" disabled={pending}>
                <Send size={16} /> {pending ? "Mengirim…" : "Kirim balasan"}
              </button>
            </form>}
        </section>
      )}
    </div>
  );
}
