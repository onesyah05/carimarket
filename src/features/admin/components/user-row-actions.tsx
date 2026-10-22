"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormModal } from "@/components/form-modal";
import { businessCategoryOptions } from "@/features/settings/lib/business-categories";

export function UserRowActions({ userId, name, status, category, onChanged }: {
  userId: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  /** Kategori bisnis saat ini; kosong bila profil belum diisi. */
  category?: string | null;
  /**
   * Dipanggil setelah data di server berubah. Di dalam DataTable, `router.refresh`
   * saja tidak cukup: barisnya diambil lewat API, bukan dari render server, jadi
   * pemanggil perlu memuat ulang halaman tabelnya sendiri.
   */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState(false);

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
      onChanged?.();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(null);
    }
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = String(new FormData(event.currentTarget).get("category") ?? "");
    await call("/api/admin/users/kategori", "PATCH", { userId, category: next }, "kategori");
    setEditingCategory(false);
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
      {category ? (
        <button className="button button--small button--ghost" type="button" disabled={pending !== null} onClick={() => { setEditingCategory(true); setError(null); }}>
          Kategori
        </button>
      ) : null}
      {error && <span className="row-error" role="alert">{error}</span>}

      {editingCategory && <FormModal
        title={`Pindahkan kategori ${name}`}
        description="Pelanggan tidak dapat mengubah kategorinya sendiri karena kategori menentukan kata kunci yang boleh dipakai. Perubahan tercatat di audit log."
        busy={pending === "kategori"}
        onClose={() => { setEditingCategory(false); setError(null); }}
      >
        <form className="plan-form" onSubmit={event => void saveCategory(event)}>
          <div className="field">
            <label htmlFor={`category-${userId}`}>Kategori bisnis</label>
            <select className="input" id={`category-${userId}`} name="category" defaultValue={category ?? ""} disabled={pending === "kategori"}>
              {businessCategoryOptions(category ?? "").map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          {error && <p className="form-feedback form-feedback--error plan-form__feedback" role="alert">{error}</p>}
          <div className="plan-form__actions">
            <button className="button button--primary" type="submit" disabled={pending === "kategori"}>{pending === "kategori" ? "Menyimpan…" : "Simpan kategori"}</button>
            <button className="button button--ghost" type="button" onClick={() => { setEditingCategory(false); setError(null); }} disabled={pending === "kategori"}>Batal</button>
          </div>
        </form>
      </FormModal>}
    </span>
  );
}
