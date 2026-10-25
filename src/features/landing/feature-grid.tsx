import { Bell, Building2, Download, Filter, ShieldCheck, Smartphone, SlidersHorizontal, Tags } from "lucide-react";

/**
 * Daftar fitur tanpa "bento".
 *
 * Kisi bento sebelumnya memakai kartu berbeda-beda ukuran dengan gradien dan
 * pendar; yang tersisa dari pesannya hanya kesan ramai. Di sini setiap kartu
 * punya bobot yang sama, dan hanya satu yang sengaja melebar agar ritmenya
 * tidak monoton.
 *
 * Isinya dibatasi pada hal yang benar-benar ada di produk hari ini.
 */

const FEATURES = [
  {
    icon: Tags,
    title: "Kata kunci dengan kata negatif",
    body: "Frasa yang Anda cari dan frasa yang harus disingkirkan, dikelola per jasa. Kata kunci terikat ke kategori bisnis agar saran yang muncul relevan.",
    wide: true,
  },
  {
    icon: Filter,
    title: "Skor relevansi dan alasannya",
    body: "Setiap lead membawa skor 0–100 dan keterangan kata kunci mana yang cocok, jadi Anda tahu kenapa ia muncul.",
  },
  {
    icon: SlidersHorizontal,
    title: "Mode balasan yang Anda pilih",
    body: "Tinjau dulu sebagai bawaan. Mode otomatis punya ambang skor, jeda kirim, batas harian, dan jam tenang.",
  },
  {
    icon: ShieldCheck,
    title: "Penyaring kata terlarang",
    body: "Draft yang memuat klaim berlebihan ditahan untuk ditinjau manusia, bukan dikirim lalu disesali.",
  },
  {
    icon: Building2,
    title: "Beberapa jasa dalam satu akun",
    body: "Satu akun dapat menaungi beberapa profil bisnis dengan kata kunci dan lead terpisah. Berganti profil tanpa keluar-masuk akun.",
  },
  {
    icon: Bell,
    title: "Notifikasi yang bisa diatur",
    body: "Pemberitahuan lead baru, balasan terkirim, dan kuota hampir habis. Semuanya di aplikasi dan lewat email sesuai preferensi Anda.",
  },
  {
    icon: Smartphone,
    title: "Aplikasi mobile",
    body: "Masuk dari aplikasi atau pasangkan lewat kode dari dashboard. Perangkat aktif dapat Anda cabut sendiri kapan saja.",
  },
  {
    icon: Download,
    title: "Data Anda tetap milik Anda",
    body: "Unduh profil, kata kunci, lead, dan riwayat draft dalam format JSON. Tutup akun sendiri kapan pun dari Pengaturan.",
  },
];

export function FeatureGrid() {
  return (
    <section className="site-section site-section--sunken" id="fitur">
      <div className="container">
        <div className="site-head" data-reveal>
          <p className="site-eyebrow">Fitur</p>
          <h2 className="site-h2">Yang ada di dalamnya, apa adanya.</h2>
          <p className="site-lead">
            Daftar ini hanya memuat hal yang sudah berjalan hari ini. Yang masih menunggu persetujuan Meta kami jawab
            di bagian pertanyaan umum, bukan kami tulis seolah sudah jadi.
          </p>
        </div>

        <div className="features">
          {FEATURES.map(feature => {
            const Icon = feature.icon;
            return (
              <article className={`feature ${feature.wide ? "feature--wide" : ""}`} key={feature.title} data-reveal>
                <span className="feature__icon"><Icon size={18} aria-hidden="true" /></span>
                <h3 className="site-h3">{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
