"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PasswordInput } from "@/components/password-input";

/**
 * Form kata sandi baru dari tautan email.
 *
 * Token tidak pernah ditempel ke kolom yang terlihat: nilainya diteruskan dari
 * query halaman sebagai prop dan dikirim sebagai JSON, supaya tidak ikut
 * tersalin saat pengguna menyalin isi form.
 */
export function ResetPasswordForm({ token, name }: { token: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password") ?? "");
    if (newPassword !== String(form.get("confirm") ?? "")) {
      setError("Kedua kata sandi belum sama.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/atur-ulang-sandi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Kata sandi belum dapat diganti. Silakan coba lagi.");
        return;
      }
      setDone(true);
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="auth-card">
        <h2>Kata sandi sudah diganti</h2>
        <p className="form-feedback form-feedback--success" role="status">
          <ShieldCheck size={15} /> Seluruh sesi dan perangkat yang masuk sebelumnya sudah dikeluarkan.
        </p>
        <p className="auth-note">Masuk sekali dengan kata sandi baru Anda. Aplikasi mobile perlu dipasangkan ulang.</p>
        <button className="button button--primary" type="button" onClick={() => router.push("/masuk")}>Masuk sekarang</button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2>Buat kata sandi baru</h2>
      <p className="auth-note">Halo {name}, pilih kata sandi yang belum pernah Anda pakai di layanan lain.</p>
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="password">Kata sandi baru</label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
            minLength={8}
            maxLength={255}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">Ulangi kata sandi baru</label>
          <PasswordInput
            id="confirm"
            name="confirm"
            placeholder="Ketik ulang kata sandi"
            autoComplete="new-password"
            minLength={8}
            maxLength={255}
            required
          />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--primary" type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan kata sandi baru"}
        </button>
      </form>
      <p className="auth-note">Mengganti kata sandi mengeluarkan semua sesi web dan mencabut token aplikasi mobile Anda.</p>
      <Link className="text-link" href="/masuk">Kembali ke halaman masuk</Link>
    </div>
  );
}
