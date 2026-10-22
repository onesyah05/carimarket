"use client";

import { useEffect } from "react";

/**
 * Menyingkap elemen saat masuk ke layar.
 *
 * Dipasang sekali per halaman. Komponen ini tidak membungkus apa pun; ia
 * memasang satu IntersectionObserver untuk seluruh elemen ber-`data-reveal`,
 * jadi menambah seksi baru cukup dengan menambahkan atribut itu — tidak perlu
 * membungkusnya dengan komponen lain.
 *
 * Dua hal yang disengaja:
 *
 * 1. Keadaan tersembunyi baru berlaku setelah penanda `data-reveal-ready`
 *    terpasang dari sini. Kalau JavaScript gagal dimuat, tidak ada satu pun
 *    elemen yang tersangkut pada opacity nol — halamannya tampil utuh seperti
 *    biasa.
 * 2. Penyingkapan hanya sekali. Elemen yang digulirkan naik-turun berulang
 *    tidak berkedip-kedip; itu melelahkan, bukan hidup.
 */

/** Jeda antar elemen dalam satu kelompok, dalam milidetik. */
const STAGGER_MS = 70;

/** Paling lama empat elemen yang diundur; sisanya ikut yang terakhir. */
const MAX_STAGGER_STEPS = 4;

export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (nodes.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // Tanpa penanda, CSS tidak pernah menyembunyikan apa pun.
      return;
    }

    root.dataset.revealReady = "true";

    // Jeda dihitung dari urutan elemen di dalam induknya, bukan di seluruh
    // halaman, supaya tiap kisi punya ritmenya sendiri.
    for (const node of nodes) {
      const siblings = Array.from(node.parentElement?.children ?? []).filter(child =>
        child instanceof HTMLElement && child.hasAttribute("data-reveal"));
      const index = Math.min(siblings.indexOf(node), MAX_STAGGER_STEPS);
      if (index > 0) node.style.transitionDelay = `${index * STAGGER_MS}ms`;
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      // Ambang kecil dengan margin bawah negatif: elemen muncul sesaat setelah
      // tepi atasnya masuk, bukan tepat saat piksel pertamanya terlihat.
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );

    for (const node of nodes) observer.observe(node);

    return () => {
      observer.disconnect();
      delete root.dataset.revealReady;
    };
  }, []);

  return null;
}
