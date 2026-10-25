import { Check } from "lucide-react";

/**
 * Dua mode balasan, berdampingan.
 *
 * Urutannya penting dan tidak boleh dibalik: "Tinjau dulu" adalah bawaan
 * produk, dan menampilkan mode otomatis lebih dulu akan menyiratkan bahwa
 * mengirim tanpa tinjauan adalah jalur normal. Aturan produk menyebutnya
 * eksplisit, jadi tampilannya mengikuti.
 */

const REVIEW_POINTS = [
  "Setiap draft menunggu persetujuan Anda",
  "Sunting nada dan isinya sebelum terkirim",
  "Tidak ada yang keluar tanpa satu klik dari Anda",
  "Aktif sejak akun pertama kali dibuat",
];

const AUTO_POINTS = [
  "Ambang skor relevansi minimum yang Anda tentukan",
  "Jeda antar pengiriman agar tidak berpola",
  "Batas balasan harian per akun",
  "Jam tenang: tidak mengirim di waktu yang Anda tutup",
  "Draft berisiko tetap ditahan untuk ditinjau manusia",
];

export function ModeCards() {
  return (
    <section className="site-section" id="mode">
      <div className="container">
        <div className="site-head" data-reveal>
          <p className="site-eyebrow">Kendali</p>
          <h2 className="site-h2">Otomatis sampai batas yang Anda tentukan sendiri.</h2>
          <p className="site-lead">
            Pencarian berjalan sendiri; pengiriman tidak, kecuali Anda memintanya. Itu pilihan yang disengaja. Balasan
            promosi yang salah nada merugikan Anda lebih dulu daripada siapa pun.
          </p>
        </div>

        <div className="modes">
          <article className="mode mode--default" data-reveal>
            <span className="mode__tag">Bawaan</span>
            <h3 className="site-h3">Tinjau dulu</h3>
            <p className="site-body">
              Draft disiapkan untuk setiap lead, lalu berhenti di antrean sampai Anda membacanya.
            </p>
            <ul className="mode__list">
              {REVIEW_POINTS.map(point => (
                <li key={point}><Check size={15} aria-hidden="true" /> <span>{point}</span></li>
              ))}
            </ul>
            <p className="mode__foot">
              Cara paling aman untuk memulai, dan untuk banyak bisnis ini sudah cukup selamanya.
            </p>
          </article>

          <article className="mode" data-reveal>
            <span className="mode__tag mode__tag--quiet">Opsional</span>
            <h3 className="site-h3">Balas otomatis, berpagar</h3>
            <p className="site-body">
              Setelah kata kunci Anda stabil dan nada balasannya cocok, sebagian pekerjaan dapat diserahkan, dengan
              pagar yang tetap Anda pegang.
            </p>
            <ul className="mode__list">
              {AUTO_POINTS.map(point => (
                <li key={point}><Check size={15} aria-hidden="true" /> <span>{point}</span></li>
              ))}
            </ul>
            <p className="mode__foot">
              Pengiriman otomatis langsung ke Threads baru berjalan penuh setelah integrasi resmi Meta rilis.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
