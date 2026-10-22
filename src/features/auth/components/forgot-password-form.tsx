"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";

/**
 * Permintaan tautan pengaturan ulang kata sandi.
 *
 * Pesan berhasilnya sengaja tidak menyatakan apakah emailnya terdaftar.
 * Halaman yang menjawab "email tidak ditemukan" memberi tahu siapa pun yang
 * membawa daftar alamat siapa saja yang punya akun di sini.
 */
export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/lupa-kata-sandi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Permintaan belum dapat diproses. Silakan coba lagi.");
        return;
      }
      setSentTo(email);
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <div className="auth-card">
        <h2>Periksa kotak masuk Anda</h2>
        <p className="form-feedback form-feedback--success" role="status">
          <MailCheck size={15} /> Jika <strong>{sentTo}</strong> terdaftar dan dapat dihubungi, tautan pengaturan ulang sudah kami kirim ke sana.
        </p>
        <p className="auth-note">
          Tautannya berlaku 60 menit dan hanya dapat dipakai sekali. Belum sampai setelah beberapa menit? Periksa folder spam,
          lalu minta tautan baru — permintaan baru membatalkan tautan sebelumnya.
        </p>
        <p className="auth-note">
          Akun yang dibuat lewat Threads tidak memakai kata sandi dan tidak menerima email ini. Masuklah dengan tombol
          <strong> Masuk dengan Threads</strong> di halaman masuk.
        </p>
        <button className="button button--ghost" type="button" onClick={() => setSentTo(null)}>Kirim ke email lain</button>
        <Link className="text-link" href="/masuk">Kembali ke halaman masuk</Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2>Minta tautan pengaturan ulang</h2>
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email akun</label>
          <input
            className="input"
            id="email"
            name="email"
            type="email"
            placeholder="nama@bisnis.id"
            autoComplete="email"
            maxLength={191}
            required
          />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--primary" type="submit" disabled={pending}>
          {pending ? "Mengirim…" : "Kirim tautan pengaturan ulang"}
        </button>
      </form>
      <p className="auth-note">Kami mengirim tautan berumur 60 menit. Kata sandi Anda tidak berubah sampai tautan itu dibuka.</p>
      <Link className="text-link" href="/masuk">Kembali ke halaman masuk</Link>
    </div>
  );
}
