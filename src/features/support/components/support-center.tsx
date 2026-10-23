"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, Lock, MessageSquarePlus } from "lucide-react";
import { FormModal } from "@/components/form-modal";
import { RichTextEditor } from "@/components/rich-text-editor";
import { formatDateTime, statusLabel } from "@/lib/format";
import { richTextToPlain } from "@/lib/rich-text";
import type { TicketDetail, TicketSummary } from "@/server/support/tickets";

/**
 * Daftar tiket milik pengguna.
 *
 * Dulu halaman ini melakukan tiga hal sekaligus di satu kolom: daftar,
 * formulir tiket baru, dan utas percakapan yang terbuka di bawahnya. Akibatnya
 * utas tidak punya alamat sendiri — tertutup setiap kali halaman dimuat ulang
 * dan tidak dapat ditempelkan ke siapa pun — sedangkan formulirnya mendorong
 * daftar turun lalu melompat balik ketika tersimpan.
 *
 * Sekarang daftarnya sebuah tabel, tiap barisnya menuju halaman tiketnya
 * sendiri, dan tiket baru dibuka sebagai dialog di atas daftar.
 */

type Props = { tickets: TicketSummary[]; emailReachable: boolean };

export function SupportCenter({ tickets, emailReachable }: Props) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (richTextToPlain(body).length < 20) {
      setError("Jelaskan kendalanya lebih dulu, minimal 20 karakter.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: form.get("subject"), body, priority: form.get("priority") }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "Tiket belum dapat dibuat. Silakan coba lagi.");
        return;
      }
      // Langsung ke tiketnya: yang dibutuhkan berikutnya adalah balasan tim,
      // dan itu ada di halaman tiket, bukan di daftar.
      const created = result?.data as TicketDetail;
      setComposing(false);
      setBody("");
      router.push(`/dashboard/bantuan/${created.id}`);
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setPending(false);
    }
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
          <button className="button button--primary" type="button" onClick={() => { setComposing(true); setError(null); }} disabled={pending}>
            <MessageSquarePlus size={16} /> Tiket baru
          </button>
        </header>

        <div className="data-table">
          <div className="data-row data-head data-row--4"><span>Judul</span><span>Status</span><span>Pesan</span><span>Diperbarui</span></div>
          {tickets.length === 0
            ? <div className="data-row table-empty-row data-row--4"><span><CircleHelp size={15} /> Belum ada tiket. Buka tiket baru dan jelaskan kendala Anda.</span></div>
            : tickets.map(ticket => (
              <button
                key={ticket.id}
                type="button"
                className="data-row data-row--4 support-ticket-row"
                onClick={() => router.push(`/dashboard/bantuan/${ticket.id}`)}
              >
                <span className="support-ticket-subject">{ticket.subject}</span>
                <span><em className={`support-badge support-badge--${CLOSED.has(ticket.status) ? "done" : "open"}`}>{statusLabel(ticket.status)}</em></span>
                <span>{ticket.messageCount} pesan</span>
                <span>{formatDateTime(ticket.updatedAt)}</span>
              </button>
            ))}
        </div>
      </section>

      {composing && (
        <FormModal title="Buka tiket baru" description="Jelaskan kendalanya sejelas mungkin agar tim tidak perlu bertanya balik." busy={pending} onClose={() => setComposing(false)}>
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
              <RichTextEditor
                id="body"
                value={body}
                onChange={setBody}
                rows={6}
                maxLength={4000}
                disabled={pending}
                placeholder="Sebutkan apa yang Anda lakukan, apa yang terjadi, dan apa yang Anda harapkan. Sertakan nama kata kunci atau waktu kejadian bila ada."
              />
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button--primary" type="submit" disabled={pending}>
              {pending ? "Mengirim…" : "Kirim tiket"}
            </button>
          </form>
          <p className="support-hint">Jangan sertakan kata sandi atau token. Tim dukungan tidak pernah memintanya.</p>
        </FormModal>
      )}
    </div>
  );
}

const CLOSED = new Set(["RESOLVED", "CLOSED"]);
