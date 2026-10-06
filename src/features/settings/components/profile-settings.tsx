"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { businessCategoryOptions } from "@/features/settings/lib/business-categories";

type Profile = { name: string; category: string; serviceArea: string; description: string };
type ResponseBody = { data?: Profile; exists?: boolean; error?: string };

const emptyProfile: Profile = { name: "", category: "", serviceArea: "", description: "" };

export function ProfileSettings({ redirectAfterSave }: { redirectAfterSave: boolean }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/business-profile", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json() as ResponseBody;
        if (!response.ok || !payload.data) throw new Error(payload.error ?? "Profil bisnis belum dapat dimuat.");
        if (active) { setProfile(payload.data); setExists(Boolean(payload.exists)); }
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Profil bisnis belum dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function update(key: keyof Profile, value: string) {
    setProfile(current => ({ ...current, [key]: value }));
    setSaved(false);
    setError(undefined);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      const response = await fetch("/api/settings/business-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const payload = await response.json() as ResponseBody;
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Profil bisnis belum dapat disimpan.");
      setProfile(payload.data);
      setExists(true);
      setSaved(true);
      if (redirectAfterSave) router.replace("/dashboard");
      else router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Profil bisnis belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="panel-heading"><div><h2>Profil bisnis</h2><p>Digunakan untuk menilai relevansi dan menyusun draft balasan.</p></div></div>
    {!loading && !exists && <p className="settings-empty-note">Isi seluruh profil bisnis sesuai usaha Anda sebelum membuka dashboard.</p>}
    <form className="form-grid" onSubmit={event => void save(event)}>
      <div className="field"><label htmlFor="business-name">Nama bisnis</label><input className="input" id="business-name" value={profile.name} onChange={event => update("name", event.target.value)} disabled={loading || saving} minLength={2} maxLength={140} required /></div>
      <div className="form-two"><div className="field"><label htmlFor="business-category">Kategori</label><select className="input" id="business-category" value={profile.category} onChange={event => update("category", event.target.value)} disabled={loading || saving} required><option value="">Pilih kategori</option>{businessCategoryOptions(profile.category).map(category => <option key={category} value={category}>{category}</option>)}</select></div><div className="field"><label htmlFor="business-area">Area layanan</label><input className="input" id="business-area" value={profile.serviceArea} onChange={event => update("serviceArea", event.target.value)} disabled={loading || saving} minLength={2} maxLength={255} required /></div></div>
      <div className="field"><label htmlFor="business-description">Deskripsi</label><textarea className="input" id="business-description" value={profile.description} onChange={event => update("description", event.target.value)} disabled={loading || saving} minLength={2} maxLength={5000} required /></div>
      {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
      {saved && <p className="form-feedback form-feedback--success" role="status">Profil bisnis tersimpan.</p>}
      <div className="settings-actions"><button className="button button--primary" type="submit" disabled={loading || saving}>{loading ? "Memuat profil..." : saving ? "Menyimpan..." : "Simpan perubahan"}</button></div>
    </form>
  </>;
}
