"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";

type PasswordForm = { currentPassword: string; newPassword: string; confirmPassword: string };

type AccountEmail = { email: string | null; isPlaceholder: boolean; verified: boolean; requiresPassword: boolean };

const emptyForm: PasswordForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function SecuritySettings({ initialHasPassword }: { initialHasPassword: boolean }) {
  const [form, setForm] = useState(emptyForm);
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [savedMessage, setSavedMessage] = useState<string>();
  const [account, setAccount] = useState<AccountEmail | null>(null);
  const [emailValue, setEmailValue] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string>();
  const [emailSaved, setEmailSaved] = useState<string>();

  useEffect(() => {
    let active = true;
    fetch("/api/settings/account-email", { cache: "no-store" })
      .then(async response => response.ok ? (await response.json() as { data?: AccountEmail }).data ?? null : null)
      .then(next => { if (active && next) { setAccount(next); setEmailValue(next.email ?? ""); } })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function saveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailSaving(true);
    setEmailError(undefined);
    setEmailSaved(undefined);
    try {
      const response = await fetch("/api/settings/account-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue, ...(account?.requiresPassword ? { currentPassword: emailPassword } : {}) }),
      });
      const payload = await response.json() as { data?: AccountEmail; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Email belum dapat disimpan.");
      setAccount(payload.data);
      setEmailValue(payload.data.email ?? "");
      setEmailPassword("");
      setEmailSaved("Email akun tersimpan. Verifikasi email belum tersedia, jadi alamat ini belum berstatus terverifikasi.");
    } catch (cause) {
      setEmailError(cause instanceof Error ? cause.message : "Email belum dapat disimpan.");
    } finally {
      setEmailSaving(false);
    }
  }

  function update(key: keyof PasswordForm, value: string) {
    setForm(current => ({ ...current, [key]: value }));
    setSavedMessage(undefined);
    setError(undefined);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError("Konfirmasi kata sandi baru belum sama.");
      return;
    }
    setSaving(true);
    setSavedMessage(undefined);
    setError(undefined);
    try {
      const response = await fetch("/api/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(hasPassword ? { currentPassword: form.currentPassword } : {}), newPassword: form.newPassword }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Kata sandi belum dapat diubah.");
      setForm(emptyForm);
      setSavedMessage(hasPassword ? "Kata sandi berhasil diubah." : "Kata sandi berhasil dibuat.");
      setHasPassword(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kata sandi belum dapat diubah.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="panel-heading"><div><h2>Keamanan dan data</h2><p>Kelola kata sandi dan unduh salinan data workspace Anda.</p></div></div>
    <div className="security-settings">
      <form className="security-settings__password" onSubmit={event => void changePassword(event)}>
        <div><h3>{hasPassword ? "Ubah kata sandi" : "Buat kata sandi"}</h3><p>{hasPassword ? "Setelah diubah, sesi lain akan keluar. Sesi ini tetap aktif." : "Akun yang dibuat lewat Threads belum memiliki kata sandi. Buat kata sandi lalu simpan email akun agar bisa masuk tanpa Threads."}</p></div>
        {hasPassword && <div className="field"><label htmlFor="current-password">Kata sandi saat ini</label><input className="input" id="current-password" type="password" autoComplete="current-password" value={form.currentPassword} onChange={event => update("currentPassword", event.target.value)} disabled={saving} required /></div>}
        <div className="field"><label htmlFor="new-password">Kata sandi baru</label><input className="input" id="new-password" type="password" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={event => update("newPassword", event.target.value)} disabled={saving} required /></div>
        <div className="field"><label htmlFor="confirm-password">Ulangi kata sandi baru</label><input className="input" id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={form.confirmPassword} onChange={event => update("confirmPassword", event.target.value)} disabled={saving} required /></div>
        {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
        {savedMessage && <p className="form-feedback form-feedback--success" role="status">{savedMessage}</p>}
        <div className="settings-actions"><button className="button button--primary" type="submit" disabled={saving}>{saving ? "Menyimpan..." : hasPassword ? "Ubah kata sandi" : "Buat kata sandi"}</button></div>
      </form>
      <form className="security-settings__email" onSubmit={event => void saveEmail(event)}>
        <div>
          <h3>Email akun</h3>
          <p>{account === null
            ? "Memuat data akun…"
            : account.isPlaceholder
              ? "Akun ini dibuat melalui Threads dan belum memiliki email nyata. Isi email Anda agar akun dapat dipulihkan dan dihubungi."
              : account.verified
                ? `Email saat ini ${account.email}. Sudah terverifikasi.`
                : `Email saat ini ${account.email}. Belum terverifikasi karena pengiriman email belum aktif.`}</p>
        </div>
        <div className="field"><label htmlFor="account-email">Email</label><input className="input" id="account-email" type="email" autoComplete="email" value={emailValue} onChange={event => { setEmailValue(event.target.value); setEmailSaved(undefined); setEmailError(undefined); }} disabled={account === null || emailSaving} maxLength={191} required /></div>
        {account?.requiresPassword && <div className="field"><label htmlFor="email-password">Kata sandi saat ini</label><input className="input" id="email-password" type="password" autoComplete="current-password" value={emailPassword} onChange={event => setEmailPassword(event.target.value)} disabled={emailSaving} required /></div>}
        {emailError && <p className="form-feedback form-feedback--error" role="alert">{emailError}</p>}
        {emailSaved && <p className="form-feedback form-feedback--success" role="status">{emailSaved}</p>}
        <div className="settings-actions"><button className="button button--primary" type="submit" disabled={account === null || emailSaving}>{emailSaving ? "Menyimpan..." : "Simpan email"}</button></div>
      </form>
      <div className="security-settings__data"><h3>Data workspace</h3><p>Unduh profil bisnis, kata kunci, lead, dan riwayat draft Anda dalam format JSON. Token integrasi dan kata sandi tidak disertakan.</p><a className="button button--ghost" href="/api/settings/data-export" download><Download size={17} /> Unduh data saya</a><Link className="text-link" href="/penghapusan-data">Baca prosedur penghapusan data</Link></div>
    </div>
  </>;
}
