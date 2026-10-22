"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { PasswordInput } from "@/components/password-input";

/**
 * Penutupan akun mandiri.
 *
 * Dibuat dua langkah dengan sengaja: tombol pertama hanya membuka penjelasan,
 * dan konfirmasinya harus diketik. Tindakan yang tidak dapat dibatalkan tidak
 * boleh berjarak satu klik dari tombol unduh data.
 */

const CONFIRMATION = "TUTUP AKUN SAYA";

export function CloseAccount({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/hapus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: form.get("confirmation"),
          currentPassword: hasPassword ? form.get("password") : undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Akun belum dapat ditutup. Silakan coba lagi.");
        return;
      }
      setClosed(true);
      // `refresh` menyusul `replace` supaya cache server untuk halaman
      // dashboard yang baru saja kosong tidak ikut terbawa.
      router.replace("/");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setPending(false);
    }
  }

  if (closed) {
    return <p className="form-feedback form-feedback--success" role="status">Akun Anda sudah ditutup. Mengalihkan ke halaman depan…</p>;
  }

  return (
    <div className="close-account">
      <h3>Tutup akun</h3>
      <p>
        Menutup akun menghapus profil bisnis, kata kunci, lead, draft balasan, notifikasi, dan koneksi Threads Anda,
        serta mencabut semua sesi dan token aplikasi mobile. Catatan pembayaran dan jejak audit tetap kami simpan sesuai
        kewajiban, dengan identitas Anda dianonimkan. Tindakan ini tidak dapat dibatalkan.
      </p>
      <p>Unduh salinan data Anda lebih dulu bila masih diperlukan.</p>

      {!open
        ? <button className="button button--ghost" type="button" onClick={() => setOpen(true)}>
          <Trash2 size={16} /> Saya ingin menutup akun
        </button>
        : <form className="form-grid" onSubmit={onSubmit}>
          <p className="close-account__warning" role="alert">
            <AlertTriangle size={16} /> Konfirmasi terakhir. Setelah tombol ini ditekan, data ruang kerja Anda tidak dapat dipulihkan.
          </p>
          {hasPassword && (
            <div className="field">
              <label htmlFor="close-password">Kata sandi saat ini</label>
              <PasswordInput id="close-password" name="password" autoComplete="current-password" required disabled={pending} />
            </div>
          )}
          <div className="field">
            <label htmlFor="close-confirmation">Ketik <code>{CONFIRMATION}</code> untuk melanjutkan</label>
            <input
              className="input"
              id="close-confirmation"
              name="confirmation"
              autoComplete="off"
              spellCheck={false}
              placeholder={CONFIRMATION}
              required
              disabled={pending}
            />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-row">
            <button className="button button--danger" type="submit" disabled={pending}>
              <Trash2 size={16} /> {pending ? "Menutup…" : "Tutup akun saya"}
            </button>
            <button className="button button--ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>
              Batal
            </button>
          </div>
        </form>}
    </div>
  );
}
