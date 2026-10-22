import { ImageResponse } from "next/og";

/**
 * Kartu Open Graph bawaan.
 *
 * Tanpa berkas ini setiap tautan yang dibagikan di WhatsApp, Threads, atau
 * LinkedIn tampil sebagai kartu kosong — padahal dibagikan lewat pesan justru
 * jalur distribusi utama di Indonesia. Dibuat sebagai gambar yang dirender,
 * bukan aset statis, supaya tidak ada berkas desain yang harus dijaga agar
 * tetap sama dengan warna merek.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Cari Market — temukan lead dari percakapan publik di Threads";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0b1739 0%, #163f96 55%, #245bc7 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#ffff00",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0b1739",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <span style={{ fontSize: 26, letterSpacing: 6, textTransform: "uppercase", opacity: 0.85 }}>
            Cari Market
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 60, lineHeight: 1.15, fontWeight: 700, maxWidth: 900 }}>
            Temukan calon klien saat mereka sedang mencari solusi Anda.
          </span>
          <span style={{ fontSize: 28, lineHeight: 1.45, opacity: 0.82, maxWidth: 860 }}>
            Radar percakapan publik Threads untuk bisnis Indonesia. Draft balasan siap, mode tinjau dulu sejak awal.
          </span>
        </div>

        <div style={{ display: "flex", gap: 18, fontSize: 22, opacity: 0.8 }}>
          <span>Skor relevansi 0–100</span>
          <span>·</span>
          <span>Jeda, batas harian, jam tenang</span>
          <span>·</span>
          <span>carimarket.id</span>
        </div>
      </div>
    ),
    size,
  );
}
