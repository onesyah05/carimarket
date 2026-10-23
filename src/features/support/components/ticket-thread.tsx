"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, UserCog } from "lucide-react";
import { formatDateTime, statusLabel } from "@/lib/format";
import { RichText } from "@/components/rich-text";
import { RichTextEditor } from "@/components/rich-text-editor";
import type { TicketDetail } from "@/server/support/tickets";

/**
 * Satu tiket beserta percakapannya.
 *
 * Dipisahkan menjadi halaman sendiri karena percakapan dukungan punya alamat:
 * orang menutup tab lalu kembali, atau menempelkan tautannya ke tim. Saat
 * utasnya hanya terbuka di dalam daftar, keadaan itu tidak dapat dibagikan dan
 * hilang setiap kali halaman dimuat ulang.
 */

const CLOSED_STATUSES = new Set(["RESOLVED", "CLOSED"]);

export function TicketThread({ ticket: initial }: { ticket: TicketDetail }) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function send(method: "POST" | "PATCH", payload?: unknown) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/support/tickets/${ticket.id}`, {
        method,
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "Permintaan belum berhasil. Silakan coba lagi.");
        return null;
      }
      const updated = result?.data as TicketDetail;
      setTicket(updated);
      // Daftar di halaman sebelumnya dirender di server, jadi ia perlu tahu
      // bahwa jumlah pesan dan statusnya sudah berubah.
      router.refresh();
      return updated;
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function reply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim().length < 2) {
      setError("Tulis balasan Anda lebih dulu.");
      return;
    }
    const updated = await send("POST", { body: draft });
    if (updated) setDraft("");
  }

  const closed = CLOSED_STATUSES.has(ticket.status);

  return (
    <div className="support-center">
      <Link className="support-back" href="/dashboard/bantuan"><ArrowLeft size={16} /> Semua tiket</Link>

      <section className="panel support-thread">
        <header className="panel-head">
          <div>
            <h2>{ticket.subject}</h2>
            <p>
              {statusLabel(ticket.status)} · prioritas {statusLabel(ticket.priority)}
              {ticket.assigneeName ? ` · ditangani ${ticket.assigneeName}` : " · menunggu penugasan"}
            </p>
          </div>
          {!closed && (
            <button className="button button--ghost" type="button" onClick={() => void send("PATCH")} disabled={pending}>
              Tandai selesai
            </button>
          )}
        </header>

        <ol className="support-messages">
          {ticket.messages.map(message => (
            <li key={message.id} className={message.fromStaff ? "is-staff" : "is-user"}>
              <p className="support-message-head">
                {message.fromStaff ? <UserCog size={14} /> : null}
                <strong>{message.fromStaff ? `${message.authorName} · Tim dukungan` : message.authorName}</strong>
                <span>{formatDateTime(message.createdAt)}</span>
              </p>
              <RichText className="support-message-body" value={message.body} />
            </li>
          ))}
        </ol>

        {error && <p className="form-error" role="alert">{error}</p>}

        {ticket.status === "CLOSED"
          ? <p className="support-hint">Tiket ini sudah ditutup. Buka tiket baru bila masih ada kendala.</p>
          : <form className="form-grid support-reply" onSubmit={reply}>
            <div className="field">
              <label htmlFor="reply-body">Balas</label>
              <RichTextEditor id="reply-body" value={draft} onChange={setDraft} disabled={pending} rows={4} placeholder="Tulis balasan Anda…" />
            </div>
            <button className="button button--primary" type="submit" disabled={pending}>
              <Send size={16} /> {pending ? "Mengirim…" : "Kirim balasan"}
            </button>
          </form>}
      </section>
    </div>
  );
}
