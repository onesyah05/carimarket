"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign } from "lucide-react";
import { resolveNextPath } from "@/lib/redirects";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const connectThreads = submitter instanceof HTMLButtonElement && submitter.value === "threads";
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(response.status === 404
          ? "Layanan masuk sedang tidak tersedia. Muat ulang halaman, lalu coba lagi."
          : payload?.error ?? "Masuk belum berhasil. Silakan coba lagi.");
        setPending(false);
        return;
      }
      if (connectThreads && payload?.data?.role === "USER") {
        window.location.assign(new URL("/api/integrations/threads/connect", window.location.origin).toString());
      } else {
        router.push(resolveNextPath(nextPath, payload?.data?.role));
        router.refresh();
      }
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>Masuk ke akun</h2>
      <form className="form-grid" onSubmit={onSubmit} noValidate={false}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" placeholder="nama@bisnis.id" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Kata sandi</label>
          <input className="input" id="password" name="password" type="password" placeholder="Kata sandi Anda" autoComplete="current-password" required />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-row">
          <label><input type="checkbox" name="remember" /> Ingat saya</label>
          <Link href="/lupa-kata-sandi">Lupa kata sandi?</Link>
        </div>
        <button className="button button--primary" type="submit" value="login" disabled={pending}>{pending ? "Memproses…" : "Masuk"}</button>
        <div className="auth-divider">atau</div>
        <button className="oauth-button" type="button" disabled={pending} onClick={() => router.push("/api/integrations/threads/connect")}><AtSign size={17} /> Masuk dengan Threads</button>
      </form>
    </div>
  );
}
