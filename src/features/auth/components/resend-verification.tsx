"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, RefreshCw } from "lucide-react";

/**
 * Tombol kirim ulang email verifikasi.
 *
 * Email bisa tersangkut di spam atau ditolak penyedia, dan tanpa tombol ini
 * pendaftar yang emailnya tidak sampai tidak punya jalan keluar selain
 * menghubungi dukungan.
 */
export function ResendVerification({ email, initialFailed = false }: { email: string; initialFailed?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    initialFailed ? "Email verifikasi belum berhasil dikirim saat pendaftaran. Coba kirim ulang." : null,
  );

  async function resend() {
    setPending(true);
    setError(null);
    setSent(false);
    try {
      const response = await fetch("/api/auth/verifikasi", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Email belum dapat dikirim ulang.");
        return;
      }
      setSent(true);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className="button button--primary" type="button" onClick={() => void resend()} disabled={pending}>
        <RefreshCw size={16} /> {pending ? "Mengirim…" : "Kirim ulang email verifikasi"}
      </button>
      {sent && <p className="form-feedback form-feedback--success" role="status">
        <MailCheck size={15} /> Email verifikasi baru sudah dikirim ke {email}. Tautan sebelumnya tidak berlaku lagi.
      </p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}
