"use client";

import { useEffect } from "react";

/**
 * Menandai header begitu halaman digulirkan.
 *
 * Satu-satunya gerak di header: garis rambut di bawahnya memudar masuk. Hero
 * karena itu tetap terasa lapang saat halaman pertama dibuka, sementara
 * navigasi tetap punya batas yang jelas ketika konten lewat di belakangnya.
 *
 * Dikerjakan lewat atribut data, bukan kelas, agar tidak bertabrakan dengan
 * kelas apa pun yang ditulis di server.
 */
export function HeaderScrollState() {
  useEffect(() => {
    const header = document.getElementById("site-header");
    if (!header) return;

    const sync = () => {
      header.dataset.scrolled = window.scrollY > 8 ? "true" : "false";
    };
    sync();

    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return null;
}
