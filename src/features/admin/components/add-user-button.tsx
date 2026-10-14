"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { FormModal } from "@/components/form-modal";
import { PasswordInput } from "@/components/password-input";

/**
 * Menambah akun pelanggan dari konsol internal.
 *
 * Operator mengetik sendiri kata sandi awalnya karena dialah yang akan
 * menyerahkannya kepada pemilik akun; tombol acak ada supaya kata sandi yang
 * diserahkan tidak jadi kata sandi yang sama untuk semua orang.
 */
function randomPassword() {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join("");
}

export function AddUserButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  function close() {
    setOpen(false);
    setError(null);
    setPassword("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    setCreated(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.get("name"), email: data.get("email"), password: data.get("password") }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Akun belum dibuat.");
        return;
      }
      setCreated(String(payload?.data?.email ?? ""));
      close();
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="plans-actions">
        <button className="button button--primary" type="button" onClick={() => { setOpen(true); setError(null); setCreated(null); }}>
          <Plus size={16} /> Tambah pengguna
        </button>
        {created && <span className="form-feedback form-feedback--success" role="status">
          Akun {created} dibuat. Serahkan kata sandi awalnya kepada pemilik akun.
        </span>}
        {error && !open && <span className="form-feedback form-feedback--error" role="alert">{error}</span>}
      </div>

      {open && <FormModal
        title="Tambah pengguna"
        description="Akun dibuat sebagai pelanggan aktif. Email belum terverifikasi karena Anda yang mengetiknya, bukan pemiliknya."
        busy={saving}
        onClose={close}
      >
        <form className="plan-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="new-user-name">Nama</label>
            <input className="input" id="new-user-name" name="name" placeholder="Mis. Nadia Pratama" required minLength={2} maxLength={120} disabled={saving} />
          </div>
          <div className="field">
            <label htmlFor="new-user-email">Email</label>
            <input className="input" id="new-user-email" name="email" type="email" placeholder="nama@contoh.id" required maxLength={191} spellCheck={false} autoComplete="off" disabled={saving} />
          </div>
          <div className="field">
            <label htmlFor="new-user-password">Kata sandi awal</label>
            <PasswordInput
              id="new-user-password"
              name="password"
              placeholder="Minimal 8 karakter"
              required
              minLength={8}
              maxLength={255}
              autoComplete="new-password"
              disabled={saving}
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
            <button className="button button--ghost button--small" type="button" onClick={() => setPassword(randomPassword())} disabled={saving}>
              Buat kata sandi acak
            </button>
          </div>
          {error && <p className="form-feedback form-feedback--error plan-form__feedback" role="alert">{error}</p>}
          <div className="plan-form__actions">
            <button className="button button--primary" type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Tambah pengguna"}</button>
            <button className="button button--ghost" type="button" onClick={close} disabled={saving}>Batal</button>
          </div>
        </form>
      </FormModal>}
    </>
  );
}
