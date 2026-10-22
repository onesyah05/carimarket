"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleHelp, X } from "lucide-react";

/**
 * Pintasan bantuan sebagai ikon melayang di sudut kanan bawah.
 *
 * Sebelumnya berupa kartu permanen di dalam sidebar: tidak dapat ditutup,
 * selalu memakan ruang menu, dan di layar sempit ikut mendorong navigasi.
 * Sekarang hanya ikon; panelnya muncul ketika diminta dan tertutup lagi
 * dengan satu klik — tidak ada yang membuka sendiri saat halaman dimuat.
 */
export function HelpLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <div className="help-launcher">
      {open && (
        <div className="help-launcher__panel" role="dialog" aria-label="Bantuan">
          <strong>Butuh bantuan?</strong>
          <p>Tim kami siap membantu setup pencarian pertama Anda.</p>
          <Link href="/dashboard/bantuan" onClick={() => setOpen(false)}>Buka tiket dukungan</Link>
        </div>
      )}
      <button
        className="help-launcher__button"
        type="button"
        aria-label={open ? "Tutup bantuan" : "Butuh bantuan?"}
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        {open ? <X size={20} /> : <CircleHelp size={20} />}
      </button>
    </div>
  );
}
