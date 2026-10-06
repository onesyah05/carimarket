"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BUSINESS_CATEGORIES } from "@/features/settings/lib/business-categories";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          businessName: form.get("businessName"),
          businessCategory: form.get("businessCategory"),
          businessArea: form.get("businessArea"),
          businessDescription: form.get("businessDescription"),
          consent: form.get("consent") === "on",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Pendaftaran belum berhasil. Silakan coba lagi.");
        setPending(false);
        return;
      }
      router.push("/onboarding/threads");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>Buat akun</h2>
      <p>Sudah punya akun? <Link href="/masuk">Masuk</Link></p>
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="name">Nama lengkap</label>
          <input className="input" id="name" name="name" placeholder="Nama Anda" autoComplete="name" required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="email">Email bisnis</label>
          <input className="input" id="email" name="email" type="email" placeholder="nama@bisnis.id" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Kata sandi</label>
          <input className="input" id="password" name="password" type="password" placeholder="Minimal 8 karakter" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="auth-form-section"><strong>Profil bisnis</strong><span>Diisi sekali saat mendaftar dan dapat diubah di Pengaturan.</span></div>
        <div className="field">
          <label htmlFor="businessName">Nama bisnis</label>
          <input className="input" id="businessName" name="businessName" placeholder="Nama usaha Anda" minLength={2} maxLength={140} required />
        </div>
        <div className="field">
          <label htmlFor="businessCategory">Kategori bisnis</label>
          <select className="input" id="businessCategory" name="businessCategory" defaultValue="" required><option value="">Pilih kategori</option>{BUSINESS_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select>
        </div>
        <div className="field">
          <label htmlFor="businessArea">Area layanan</label>
          <input className="input" id="businessArea" name="businessArea" placeholder="Contoh: Jabodetabek" maxLength={255} />
        </div>
        <div className="field">
          <label htmlFor="businessDescription">Deskripsi bisnis</label>
          <textarea className="input" id="businessDescription" name="businessDescription" placeholder="Apa yang Anda tawarkan?" minLength={2} maxLength={5000} required />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label className="consent">
          <input type="checkbox" name="consent" required />
          <span>Saya menyetujui <Link href="/syarat-ketentuan">Syarat dan Ketentuan</Link> serta <Link href="/kebijakan-privasi">Kebijakan Privasi</Link>.</span>
        </label>
        <button className="button button--primary" type="submit" disabled={pending}>{pending ? "Memproses…" : "Daftar dan lanjutkan"}</button>
      </form>
      <p className="auth-note">Profil bisnis tersimpan bersama akun Anda. Koneksi Threads dapat diatur setelah mendaftar.</p>
    </div>
  );
}
