"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/password-input";

/**
 * Pendaftaran mandiri.
 *
 * Setelah berhasil, pengguna langsung dibawa ke halaman "cek email" alih-alih
 * ditinggal di formulir dengan pesan sukses: di sanalah tombol kirim ulang
 * berada, dan itu satu-satunya hal yang mungkin mereka butuhkan berikutnya.
 */
export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("Konfirmasi kata sandi belum sama.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password,
          acceptTerms: form.get("terms") === "on",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Pendaftaran belum berhasil. Silakan coba lagi.");
        setPending(false);
        return;
      }
      router.push(payload?.data?.delivered === false ? "/verifikasi/menunggu?kirim=gagal" : "/verifikasi/menunggu");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>Buat akun</h2>
      <p className="auth-note">Verifikasi email dulu, lalu pilih paket langganan. Setelah itu ruang kerja Anda terbuka.</p>
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="name">Nama</label>
          <input className="input" id="name" name="name" placeholder="Nama Anda" autoComplete="name" required minLength={2} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="email">Email bisnis</label>
          <input className="input" id="email" name="email" type="email" placeholder="nama@bisnis.id" autoComplete="email" required maxLength={191} />
        </div>
        <div className="field">
          <label htmlFor="password">Kata sandi</label>
          <PasswordInput id="password" name="password" placeholder="Minimal 8 karakter" autoComplete="new-password" required minLength={8} maxLength={255} />
        </div>
        <div className="field">
          <label htmlFor="confirm">Ulangi kata sandi</label>
          <PasswordInput id="confirm" name="confirm" placeholder="Ketik ulang kata sandi" autoComplete="new-password" required minLength={8} maxLength={255} />
        </div>
        <label className="auth-consent">
          <input type="checkbox" name="terms" required />
          <span>Saya menyetujui <Link href="/syarat-ketentuan">syarat dan ketentuan</Link> serta <Link href="/kebijakan-privasi">kebijakan privasi</Link>.</span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--primary" type="submit" disabled={pending}>{pending ? "Mendaftarkan…" : "Daftar"}</button>
      </form>
      <p className="auth-note">Sudah punya akun? <Link className="text-link" href="/masuk">Masuk di sini</Link></p>
    </div>
  );
}
