"use client";

import { FormEvent, useEffect, useState } from "react";

export type Account = {
  name: string;
  email: string | null;
  emailIsPlaceholder: boolean;
  emailVerified: boolean;
  hasPassword: boolean;
  requiresPasswordForEmailChange: boolean;
};

type PasswordForm = { currentPassword: string; newPassword: string; confirmPassword: string };

const emptyPassword: PasswordForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

/**
 * Form identitas dan kata sandi akun.
 *
 * Dipakai bersama oleh pengaturan pengguna bisnis dan halaman profil akun
 * internal, karena nama, email, dan kata sandi adalah milik akun dan aturannya
 * sama untuk semua role.
 *
 * `initialAccount` dikirim dari server agar judul dan kolom tidak sempat salah
 * tampil sebelum data termuat.
 */
export function AccountForms({ initialAccount }: { initialAccount?: Account }) {
  const [account, setAccount] = useState<Account | null>(initialAccount ?? null);
  const [name, setName] = useState(initialAccount?.name ?? "");
  const [email, setEmail] = useState(initialAccount?.email ?? "");
  const [identityPassword, setIdentityPassword] = useState("");
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityError, setIdentityError] = useState<string>();
  const [identitySaved, setIdentitySaved] = useState<string>();

  const [password, setPassword] = useState(emptyPassword);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string>();
  const [passwordSaved, setPasswordSaved] = useState<string>();

  useEffect(() => {
    if (initialAccount) return;
    let active = true;
    fetch("/api/account/profile", { cache: "no-store" })
      .then(async response => response.ok ? (await response.json() as { data?: Account }).data ?? null : null)
      .then(next => {
        if (!active || !next) return;
        setAccount(next);
        setName(next.name);
        setEmail(next.email ?? "");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [initialAccount]);

  const emailChanged = account !== null && email.trim().toLowerCase() !== (account.email ?? "").toLowerCase();
  const needsPasswordForEmail = Boolean(account?.requiresPasswordForEmailChange) && emailChanged;

  async function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIdentityBusy(true);
    setIdentityError(undefined);
    setIdentitySaved(undefined);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, ...(needsPasswordForEmail ? { currentPassword: identityPassword } : {}) }),
      });
      const payload = await response.json() as { data?: Account; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Data akun belum dapat disimpan.");
      setAccount(payload.data);
      setName(payload.data.name);
      setEmail(payload.data.email ?? "");
      setIdentityPassword("");
      setIdentitySaved(payload.data.emailVerified
        ? "Data akun tersimpan."
        : "Data akun tersimpan. Email belum berstatus terverifikasi karena pengiriman email belum aktif.");
    } catch (cause) {
      setIdentityError(cause instanceof Error ? cause.message : "Data akun belum dapat disimpan.");
    } finally {
      setIdentityBusy(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      setPasswordError("Konfirmasi kata sandi baru belum sama.");
      return;
    }
    setPasswordBusy(true);
    setPasswordError(undefined);
    setPasswordSaved(undefined);
    try {
      const response = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(account?.hasPassword ? { currentPassword: password.currentPassword } : {}),
          newPassword: password.newPassword,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Kata sandi belum dapat diubah.");
      setPassword(emptyPassword);
      setPasswordSaved(account?.hasPassword ? "Kata sandi berhasil diubah. Sesi lain telah dikeluarkan." : "Kata sandi berhasil dibuat.");
      setAccount(current => current ? { ...current, hasPassword: true, requiresPasswordForEmailChange: true } : current);
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : "Kata sandi belum dapat diubah.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return <>
    <form className="account-form" onSubmit={event => void saveIdentity(event)}>
      <div>
        <h3>Identitas akun</h3>
        <p>{account === null
          ? "Memuat data akun…"
          : account.emailIsPlaceholder
            ? "Akun ini dibuat melalui Threads dan belum memiliki email nyata. Isi email Anda agar akun dapat dipulihkan dan dihubungi."
            : account.emailVerified
              ? "Email akun sudah terverifikasi."
              : "Email akun belum terverifikasi karena pengiriman email belum aktif."}</p>
      </div>
      <div className="field"><label htmlFor="account-name">Nama</label><input className="input" id="account-name" value={name} onChange={event => { setName(event.target.value); setIdentitySaved(undefined); setIdentityError(undefined); }} disabled={account === null || identityBusy} minLength={2} maxLength={120} required /></div>
      <div className="field"><label htmlFor="account-email">Email</label><input className="input" id="account-email" type="email" autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setIdentitySaved(undefined); setIdentityError(undefined); }} disabled={account === null || identityBusy} maxLength={191} required /></div>
      {needsPasswordForEmail && <div className="field"><label htmlFor="account-current-password">Kata sandi saat ini</label><input className="input" id="account-current-password" type="password" autoComplete="current-password" value={identityPassword} onChange={event => setIdentityPassword(event.target.value)} disabled={identityBusy} required /><small className="field-hint">Diperlukan karena Anda mengganti email akun.</small></div>}
      {identityError && <p className="form-feedback form-feedback--error" role="alert">{identityError}</p>}
      {identitySaved && <p className="form-feedback form-feedback--success" role="status">{identitySaved}</p>}
      <div className="settings-actions"><button className="button button--primary" type="submit" disabled={account === null || identityBusy}>{identityBusy ? "Menyimpan..." : "Simpan identitas"}</button></div>
    </form>

    <form className="account-form" onSubmit={event => void savePassword(event)}>
      <div>
        <h3>{account?.hasPassword ? "Ubah kata sandi" : "Buat kata sandi"}</h3>
        <p>{account?.hasPassword
          ? "Setelah diubah, sesi lain akan keluar. Sesi ini tetap aktif."
          : "Akun yang dibuat lewat Threads belum memiliki kata sandi. Buat kata sandi agar dapat masuk dengan email, termasuk dari aplikasi mobile."}</p>
      </div>
      {account?.hasPassword && <div className="field"><label htmlFor="current-password">Kata sandi saat ini</label><input className="input" id="current-password" type="password" autoComplete="current-password" value={password.currentPassword} onChange={event => { setPassword(current => ({ ...current, currentPassword: event.target.value })); setPasswordError(undefined); setPasswordSaved(undefined); }} disabled={passwordBusy} required /></div>}
      <div className="field"><label htmlFor="new-password">Kata sandi baru</label><input className="input" id="new-password" type="password" autoComplete="new-password" minLength={8} value={password.newPassword} onChange={event => { setPassword(current => ({ ...current, newPassword: event.target.value })); setPasswordError(undefined); setPasswordSaved(undefined); }} disabled={passwordBusy} required /></div>
      <div className="field"><label htmlFor="confirm-password">Ulangi kata sandi baru</label><input className="input" id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={password.confirmPassword} onChange={event => { setPassword(current => ({ ...current, confirmPassword: event.target.value })); setPasswordError(undefined); }} disabled={passwordBusy} required /></div>
      {passwordError && <p className="form-feedback form-feedback--error" role="alert">{passwordError}</p>}
      {passwordSaved && <p className="form-feedback form-feedback--success" role="status">{passwordSaved}</p>}
      <div className="settings-actions"><button className="button button--primary" type="submit" disabled={passwordBusy}>{passwordBusy ? "Menyimpan..." : account?.hasPassword ? "Ubah kata sandi" : "Buat kata sandi"}</button></div>
    </form>
  </>;
}
