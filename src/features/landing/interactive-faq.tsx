"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PublicFaq } from "@/server/cms/faq";

/**
 * Akordeon pertanyaan umum.
 *
 * Isinya dibaca dari CMS, jadi komponen ini tidak menyimpan teks apa pun —
 * hanya penyaring kategori dan satu panel terbuka pada satu waktu.
 *
 * Kategori di database memakai huruf kapital; pil penyaring memakai huruf
 * kecil. Pemetaannya ditaruh di sini supaya enum database tidak merembes ke
 * teks tombol.
 */

const CATEGORY_KEY = { UMUM: "umum", FITUR: "fitur", KEAMANAN: "keamanan", HARGA: "harga" } as const;

type CategoryKey = (typeof CATEGORY_KEY)[keyof typeof CATEGORY_KEY];

const FILTERS: Array<readonly ["semua" | CategoryKey, string]> = [
  ["semua", "Semua"],
  ["umum", "Cara kerja"],
  ["fitur", "Mode & fitur"],
  ["keamanan", "Keamanan & Meta"],
  ["harga", "Paket & harga"],
];

export function InteractiveFaq({ items }: { items: PublicFaq[] }) {
  const [category, setCategory] = useState<"semua" | CategoryKey>("semua");
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  const faqs = items.map(item => ({ ...item, key: CATEGORY_KEY[item.category] }));
  const visible = category === "semua" ? faqs : faqs.filter(faq => faq.key === category);
  // Pil untuk kategori yang tidak punya isi hanya menghasilkan daftar kosong.
  const available = new Set(faqs.map(faq => faq.key));

  return (
    <section className="site-section" id="faq">
      <div className="container container--narrow">
        <div className="site-head" data-reveal>
          <p className="site-eyebrow">Pertanyaan umum</p>
          <h2 className="site-h2">Hal yang biasanya ditanyakan lebih dulu.</h2>
        </div>

        <div className="faq" data-reveal>
          <div className="faq__filters" role="group" aria-label="Saring pertanyaan menurut topik">
            {FILTERS.filter(([key]) => key === "semua" || available.has(key)).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="faq__filter"
                aria-pressed={category === key}
                onClick={() => {
                  setCategory(key);
                  // Panel pertama dari hasil saringan dibuka, bukan dibiarkan
                  // menunjuk pertanyaan yang baru saja tersaring keluar.
                  const next = key === "semua" ? faqs : faqs.filter(faq => faq.key === key);
                  setOpenId(next[0]?.id ?? null);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {visible.map(faq => {
            const isOpen = openId === faq.id;
            return (
              <div className={`faq__item ${isOpen ? "is-open" : ""}`} key={faq.id}>
                <h3>
                  <button
                    type="button"
                    className="faq__question"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${faq.id}`}
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className="faq__chevron" size={18} aria-hidden="true" />
                  </button>
                </h3>
                {isOpen && <p className="faq__answer" id={`faq-answer-${faq.id}`}>{faq.answer}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
