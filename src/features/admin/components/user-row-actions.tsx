"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserRowActions({ userId, name, status }: { userId: string; name: string; status: "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, method: string, body: unknown, label: string) {
    setPending(label);
    setError(null);
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Aksi belum berhasil.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(null);
    }
  }

  const suspended = status === "SUSPENDED";

  return (
    <span className="row-actions">
      <button
        className={`button button--small ${suspended ? "button--primary" : "button--danger"}`}
        type="button"
        disabled={pending !== null}
        onClick={() => {
          const message = suspended ? `Aktifkan kembali akun ${name}?` : `Tangguhkan akun ${name}? Sesi aktif pengguna akan diakhiri.`;
          if (window.confirm(message)) void call("/api/admin/users", "PATCH", { userId, status: suspended ? "ACTIVE" : "SUSPENDED" }, "status");
        }}
      >
        {pending === "status" ? "…" : suspended ? "Aktifkan" : "Tangguhkan"}
      </button>
      <button
        className="button button--small button--ghost"
        type="button"
        disabled={pending !== null}
        onClick={() => {
          if (window.confirm(`Reset koneksi Threads milik ${name}? Token tersimpan akan dihapus.`)) {
            void call("/api/admin/users/connections", "POST", { userId }, "reset");
          }
        }}
      >
        {pending === "reset" ? "…" : "Reset koneksi"}
      </button>
      {error && <span className="row-error" role="alert">{error}</span>}
    </span>
  );
}
