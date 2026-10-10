"use client";

import { FormEvent, useEffect, useState } from "react";

type Preferences = { emailLead: boolean; emailReply: boolean; emailQuota: boolean };
type ResponseBody = { data?: Preferences; error?: string };

const defaults: Preferences = { emailLead: true, emailReply: true, emailQuota: true };

export function NotificationSettings() {
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/notifications", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json() as ResponseBody;
        if (!response.ok || !payload.data) throw new Error(payload.error ?? "Preferensi notifikasi belum dapat dimuat.");
        if (active) { setPreferences(payload.data); setLoaded(true); }
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Preferensi notifikasi belum dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function update(key: keyof Preferences, checked: boolean) {
    setPreferences(current => ({ ...current, [key]: checked }));
    setSaved(false);
    setError(undefined);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const payload = await response.json() as ResponseBody;
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Preferensi notifikasi belum dapat disimpan.");
      setPreferences(payload.data);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preferensi notifikasi belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="panel-heading"><div><h2>Notifikasi</h2><p>Notifikasi dalam aplikasi selalu aktif dan muncul di ikon lonceng. Pilihan di bawah mengatur salinan email.</p></div></div>
    <form className="notification-settings" onSubmit={event => void save(event)}>
      <div className="preference-list">
        <label><input type="checkbox" checked={preferences.emailLead} onChange={event => update("emailLead", event.target.checked)} disabled={!loaded || saving} /><span><strong>Lead baru</strong><small>Pembaruan saat ada lead yang sesuai kata kunci.</small></span></label>
        <label><input type="checkbox" checked={preferences.emailReply} onChange={event => update("emailReply", event.target.checked)} disabled={!loaded || saving} /><span><strong>Status balasan</strong><small>Perubahan status draft dan balasan yang dikirim.</small></span></label>
        <label><input type="checkbox" checked={preferences.emailQuota} onChange={event => update("emailQuota", event.target.checked)} disabled={!loaded || saving} /><span><strong>Batas kuota</strong><small>Peringatan saat penggunaan mendekati batas.</small></span></label>
      </div>
      <p className="settings-note">Pilihan Anda tersimpan di akun. Pengiriman email belum dikonfigurasi, jadi untuk sementara notifikasi hanya tampil di dalam aplikasi.</p>
      {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
      {saved && <p className="form-feedback form-feedback--success" role="status">Preferensi notifikasi tersimpan.</p>}
      <div className="settings-actions"><button className="button button--primary" type="submit" disabled={!loaded || saving}>{loading ? "Memuat pilihan..." : saving ? "Menyimpan..." : "Simpan pilihan"}</button></div>
    </form>
  </>;
}
