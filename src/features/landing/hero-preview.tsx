"use client";

import { useState } from "react";
import { Clock, FileText, MapPin, PencilLine } from "lucide-react";

/**
 * Pratinjau satu lead di hero.
 *
 * Menggantikan "radar interaktif" yang berputar terus-menerus. Yang
 * sebenarnya perlu dipahami calon pengguna hanya satu hal: seperti apa bentuk
 * satu lead dan draft balasannya. Satu kartu diam menjawab itu lebih baik
 * daripada animasi sapuan.
 *
 * Isi contohnya fiktif dan labelnya terlihat, bukan hanya di `aria-label`:
 * nama serta akun di bawah ini sengaja tidak menyerupai akun Threads nyata
 * milik siapa pun.
 */

type Example = {
  id: string;
  field: string;
  author: string;
  handle: string;
  initials: string;
  place: string;
  posted: string;
  keyword: string;
  score: number;
  post: string;
  drafts: { hangat: string; ringkas: string };
};

const EXAMPLES: Example[] = [
  {
    id: "drone",
    field: "Foto & drone",
    author: "Rian Hendrawan",
    handle: "@contoh.rian",
    initials: "RH",
    place: "BSD, Tangerang",
    posted: "6 menit lalu",
    keyword: "jasa drone · dokumentasi proyek",
    score: 92,
    post: "Ada rekomendasi vendor drone dan fotografer untuk dokumentasi progres konstruksi warehouse di BSD? Butuh untuk pengambilan Sabtu ini.",
    drafts: {
      hangat:
        "Halo Mas Rian, salam kenal. Kami berbasis di Serpong dan biasa mengambil progres proyek warehouse dengan pilot berizin. Kalau masih mencari untuk Sabtu, portofolio dan rate card bisa kami kirim lewat DM. Semoga lancar proyeknya.",
      ringkas:
        "Halo Mas Rian. Kami layani foto dan drone untuk dokumentasi konstruksi area Jabodetabek, pilot bersertifikat. Boleh kami kirim portofolio progres proyek lewat DM?",
    },
  },
  {
    id: "interior",
    field: "Interior & arsitek",
    author: "Bramantyo Wicaksono",
    handle: "@contoh.bram",
    initials: "BW",
    place: "Jakarta Barat",
    posted: "18 menit lalu",
    keyword: "jasa interior · apartemen studio",
    score: 88,
    post: "Teman-teman ada rekomendasi desainer interior yang rapi untuk makeover apartemen studio 24 m² di Kebon Jeruk? Mau disewakan bulan depan.",
    drafts: {
      hangat:
        "Halo Mas Bram. Kami sering menggarap unit studio untuk kebutuhan sewa di Jakbar, fokus ke material awet dan efisiensi ruang. Kalau berkenan, kami kirimkan katalog beserta estimasi biaya untuk studio 24 m² lewat DM.",
      ringkas:
        "Halo Mas Bram. Kami kerjakan interior studio untuk unit sewaan di Jakbar. Boleh kami kirim estimasi biaya dan contoh pengerjaan 24 m² lewat DM?",
    },
  },
  {
    id: "katering",
    field: "Katering & kuliner",
    author: "Cynthia Natalia",
    handle: "@contoh.cynthia",
    initials: "CN",
    place: "Jakarta Selatan",
    posted: "41 menit lalu",
    keyword: "katering kantor · tumpeng",
    score: 85,
    post: "Lagi cari katering kantor area Tebet yang bisa rutin tiap minggu, menu rumahan dan bisa request tumpeng sesekali. Ada yang pernah pakai?",
    drafts: {
      hangat:
        "Halo Kak Cynthia. Dapur kami di Tebet dan rutin melayani katering mingguan untuk kantor dengan menu rumahan, termasuk tumpeng untuk acara. Kalau masih mencari, daftar menu dan harga per porsi bisa kami kirim lewat DM.",
      ringkas:
        "Halo Kak Cynthia. Kami katering kantor area Tebet, menu rumahan mingguan dan bisa tumpeng. Boleh kami kirim daftar menu dan harga per porsi lewat DM?",
    },
  },
];

const TONES = [
  { key: "hangat" as const, label: "Hangat" },
  { key: "ringkas" as const, label: "Ringkas" },
];

export function HeroPreview() {
  const [activeId, setActiveId] = useState(EXAMPLES[0].id);
  const [tone, setTone] = useState<"hangat" | "ringkas">("hangat");
  const example = EXAMPLES.find(item => item.id === activeId) ?? EXAMPLES[0];

  return (
    <div className="preview">
      <p className="preview__label">Contoh tampilan — nama, akun, dan postingan di bawah ini fiktif</p>

      <div className="preview__tabs" role="tablist" aria-label="Pilih bidang usaha untuk contoh">
        {EXAMPLES.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="preview__tab"
            aria-selected={item.id === example.id}
            onClick={() => setActiveId(item.id)}
          >
            {item.field}
          </button>
        ))}
      </div>

      <article className="preview__card">
        <div className="preview__post">
          <div className="preview__author">
            <span className="preview__avatar" aria-hidden="true">{example.initials}</span>
            <span className="preview__author-name">
              <strong>{example.author}</strong>
              <span>{example.handle}</span>
            </span>
          </div>

          <p className="preview__text">{example.post}</p>

          <ul className="preview__meta">
            <li><Clock size={13} aria-hidden="true" /> {example.posted}</li>
            <li><MapPin size={13} aria-hidden="true" /> {example.place}</li>
            <li className="preview__score">Skor <b>{example.score}</b></li>
          </ul>

          <p className="site-note">Cocok dengan kata kunci: {example.keyword}</p>
        </div>

        <div className="preview__draft">
          <div className="preview__draft-head">
            <span><FileText size={13} aria-hidden="true" /> Draft balasan</span>
            <div className="preview__tones" role="group" aria-label="Pilih nada balasan">
              {TONES.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className="preview__tone"
                  aria-pressed={tone === item.key}
                  onClick={() => setTone(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <p className="preview__draft-body">{example.drafts[tone]}</p>

          <p className="preview__draft-foot">
            <PencilLine size={13} aria-hidden="true" />
            Menunggu tinjauan Anda — tidak ada yang terkirim sebelum Anda menyetujuinya.
          </p>
        </div>
      </article>
    </div>
  );
}
