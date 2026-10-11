"use client";

import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Dialog untuk form tambah dan ubah data di konsol internal.
 *
 * Form semacam ini selalu tentang satu catatan, jadi tempatnya di atas daftar,
 * bukan menyisip di dalamnya: daftar tidak terdorong turun lalu melompat balik
 * saat tersimpan. Menutup ditahan selama penyimpanan berjalan supaya hasilnya,
 * termasuk pesan kesalahan, tidak pernah hilang sebelum terbaca.
 */
export function FormModal({ title, description, busy = false, onClose, children }: {
  title: string;
  description?: string;
  busy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="modal-panel modal-panel--form" role="dialog" aria-modal="true" aria-label={title} ref={panelRef}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" type="button" aria-label="Tutup form" onClick={close} disabled={busy}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
