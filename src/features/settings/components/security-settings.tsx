"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";

type PasswordForm = { currentPassword: string; newPassword: string; confirmPassword: string };

const emptyForm: PasswordForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function SecuritySettings() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  function update(key: keyof PasswordForm, value: string) {
    setForm(current => ({ ...current, [key]: value }));
    setSaved(false);
    setError(undefined);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError("Konfirmasi kata sandi baru belum sama.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      const response = await fetch("/api/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Kata sandi belum dapat diubah.");
      setForm(emptyForm);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kata sandi belum dapat diubah.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="panel-heading"><div><h2>Keamanan dan data</h2><p>Ubah kata sandi dan unduh salinan data workspace Anda.</p></div></div>
    <div className="security-settings">
      <form className="security-settings__password" onSubmit={event => void changePassword(event)}>
        <div><h3>Ubah kata sandi</h3><p>Setelah diubah, sesi lain akan keluar. Sesi ini tetap aktif.</p></div>
        <div className="field"><label htmlFor="current-password">Kata sandi saat ini</label><input className="input" id="current-password" type="password" autoComplete="current-password" value={form.currentPassword} onChange={event => update("currentPassword", event.target.value)} disabled={saving} required /></div>
        <div className="field"><label htmlFor="new-password">Kata sandi baru</label><input className="input" id="new-password" type="password" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={event => update("newPassword", event.target.value)} disabled={saving} required /></div>
        <div className="field"><label htmlFor="confirm-password">Ulangi kata sandi baru</label><input className="input" id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={form.confirmPassword} onChange={event => update("confirmPassword", event.target.value)} disabled={saving} required /></div>
        {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
        {saved && <p className="form-feedback form-feedback--success" role="status">Kata sandi berhasil diubah.</p>}
        <div className="settings-actions"><button className="button button--primary" type="submit" disabled={saving}>{saving ? "Mengubah..." : "Ubah kata sandi"}</button></div>
      </form>
      <div className="security-settings__data"><h3>Data workspace</h3><p>Unduh profil bisnis, kata kunci, lead, dan riwayat draft Anda dalam format JSON. Token integrasi dan kata sandi tidak disertakan.</p><a className="button button--ghost" href="/api/settings/data-export" download><Download size={17} /> Unduh data saya</a><Link className="text-link" href="/penghapusan-data">Baca prosedur penghapusan data</Link></div>
    </div>
  </>;
}
