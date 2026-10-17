"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Check, ChevronsUpDown, Plus } from "lucide-react";
import { FormModal } from "@/components/form-modal";
import { businessCategoryOptions } from "@/features/settings/lib/business-categories";

export type SwitcherProfile = { id: string; name: string; category: string };

/**
 * Pemilih jasa di kepala sidebar.
 *
 * Satu akun dapat menaungi beberapa jasa, dan tiap jasa punya kata kunci,
 * lead, serta balasannya sendiri. Karena itu pemilihnya berada di tempat yang
 * selama ini menampilkan nama workspace: yang berpindah bukan sekadar label,
 * melainkan seluruh isi ruang kerja.
 */
export function ProfileSwitcher({ profiles, activeId, canAdd, limit, role }: {
  profiles: SwitcherProfile[];
  activeId: string | null;
  canAdd: boolean;
  limit: number | null;
  role: "user" | "admin" | "superadmin";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = profiles.find(profile => profile.id === activeId) ?? profiles[0] ?? null;
  const initials = (active?.name ?? "?").split(" ").map(part => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  async function pick(profileId: string) {
    if (profileId === active?.id) { setOpen(false); return; }
    setBusy(true);
    const response = await fetch("/api/workspace/jasa", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Jasa belum dapat dipindah.");
      return;
    }
    setOpen(false);
    // Seluruh halaman memuat data jasa aktif, jadi yang disegarkan bukan satu
    // komponen melainkan rute yang sedang dibuka.
    router.refresh();
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/workspace/jasa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          category: data.get("category"),
          serviceArea: data.get("serviceArea"),
          description: data.get("description"),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Jasa belum dapat ditambahkan.");
        return;
      }
      setAdding(false);
      setOpen(false);
      // Jasa baru langsung menjadi yang aktif dan belum punya kata kunci, jadi
      // tujuannya adalah langkah kata kunci onboarding.
      router.push("/onboarding/kata-kunci");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  // Akun internal tidak punya jasa; chip-nya tetap seperti semula.
  if (role !== "user") {
    return <div className="workspace-chip"><span>{initials}</span><div><strong>Workspace internal</strong><small>Tim Cari Market</small></div></div>;
  }

  return (
    <div className="workspace-switch">
      <button className="workspace-chip workspace-chip--button" type="button" onClick={() => setOpen(current => !current)} aria-expanded={open} disabled={busy}>
        <span>{initials}</span>
        <div><strong>{active?.name ?? "Profil belum diisi"}</strong><small>{active?.category ?? "Workspace bisnis"}</small></div>
        <ChevronsUpDown size={16} />
      </button>

      {open && (
        <div className="workspace-switch__menu" role="menu">
          <p className="workspace-switch__caption">
            <Briefcase size={13} /> Jasa dalam akun ini{limit !== null ? ` · ${profiles.length} dari ${limit}` : ""}
          </p>
          {profiles.map(profile => (
            <button key={profile.id} type="button" role="menuitem" className={profile.id === active?.id ? "is-active" : ""} disabled={busy} onClick={() => void pick(profile.id)}>
              <span><strong>{profile.name}</strong><small>{profile.category}</small></span>
              {profile.id === active?.id && <Check size={15} />}
            </button>
          ))}
          {canAdd
            ? <button type="button" className="workspace-switch__add" disabled={busy} onClick={() => { setAdding(true); setError(null); }}><Plus size={15} /> Tambah jasa</button>
            : <p className="workspace-switch__note">Jatah jasa pada paket Anda sudah penuh. Naikkan paket untuk menambah jasa lain.</p>}
          {error && <p className="workspace-switch__note" role="alert">{error}</p>}
        </div>
      )}

      {adding && <FormModal
        title="Tambah jasa"
        description="Jasa baru punya kata kunci, lead, dan balasannya sendiri. Kuota paket tetap dibagi bersama seluruh jasa dalam akun ini."
        busy={busy}
        onClose={() => { setAdding(false); setError(null); }}
      >
        <form className="plan-form" onSubmit={event => void create(event)}>
          <div className="field">
            <label htmlFor="new-profile-name">Nama jasa</label>
            <input className="input" id="new-profile-name" name="name" placeholder="Mis. Interior 360" required minLength={2} maxLength={140} disabled={busy} />
          </div>
          <div className="field">
            <label htmlFor="new-profile-category">Kategori</label>
            <select className="input" id="new-profile-category" name="category" required defaultValue="" disabled={busy}>
              <option value="" disabled>Pilih kategori</option>
              {businessCategoryOptions("").map(category => <option key={category} value={category}>{category}</option>)}
            </select>
            <span className="field-hint">Kategori menentukan kata kunci yang boleh dipakai dan terkunci setelah dipilih.</span>
          </div>
          <div className="field">
            <label htmlFor="new-profile-area">Area layanan</label>
            <input className="input" id="new-profile-area" name="serviceArea" placeholder="Mis. Jabodetabek" required minLength={2} maxLength={255} disabled={busy} />
          </div>
          <div className="field plan-form__toggle">
            <label htmlFor="new-profile-description">Deskripsi singkat</label>
            <textarea className="input input--textarea" id="new-profile-description" name="description" rows={3} placeholder="Apa yang dikerjakan jasa ini?" required minLength={10} maxLength={1000} disabled={busy} />
          </div>
          {error && <p className="form-feedback form-feedback--error plan-form__feedback" role="alert">{error}</p>}
          <div className="plan-form__actions">
            <button className="button button--primary" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Tambah jasa"}</button>
            <button className="button button--ghost" type="button" onClick={() => setAdding(false)} disabled={busy}>Batal</button>
          </div>
        </form>
      </FormModal>}
    </div>
  );
}
