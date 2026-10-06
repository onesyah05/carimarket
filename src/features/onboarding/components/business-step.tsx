"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { businessCategoryOptions } from "@/features/settings/lib/business-categories";

type Profile = { name: string; category: string; serviceArea: string; description: string };

export function BusinessStep({ initialProfile }: { initialProfile: Profile }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  function update(key: keyof Profile, value: string) {
    setProfile(current => ({ ...current, [key]: value }));
    setError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch("/api/settings/business-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Profil bisnis belum dapat disimpan.");
      router.push("/onboarding/threads");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Profil bisnis belum dapat disimpan.");
      setSaving(false);
    }
  }

  return <form className="onboarding-form" onSubmit={event => void submit(event)}>
    <div className="field"><label htmlFor="business">Nama bisnis</label><input className="input" id="business" value={profile.name} onChange={event => update("name", event.target.value)} placeholder="Contoh: Langit Visual" minLength={2} maxLength={140} disabled={saving} required /></div>
    <div className="form-two"><div className="field"><label htmlFor="category">Kategori</label><select className="input" id="category" value={profile.category} onChange={event => update("category", event.target.value)} disabled={saving} required><option value="">Pilih kategori</option>{businessCategoryOptions(profile.category).map(category => <option key={category} value={category}>{category}</option>)}</select></div><div className="field"><label htmlFor="location">Area layanan</label><input className="input" id="location" value={profile.serviceArea} onChange={event => update("serviceArea", event.target.value)} placeholder="Contoh: Jabodetabek" minLength={2} maxLength={255} disabled={saving} required /></div></div>
    <div className="field"><label htmlFor="description">Deskripsi singkat</label><textarea className="input" id="description" value={profile.description} onChange={event => update("description", event.target.value)} placeholder="Apa yang Anda tawarkan dan siapa pelanggan ideal Anda?" minLength={2} maxLength={5000} disabled={saving} required /></div>
    {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
    <button className="button button--primary" type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan dan lanjutkan"}</button>
  </form>;
}
