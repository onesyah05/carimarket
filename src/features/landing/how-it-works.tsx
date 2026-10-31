/**
 * Empat langkah sebagai alur menurun, bukan kisi kartu.
 *
 * Seksi lain di halaman ini sudah berbentuk kisi; kalau yang ini ikut, seluruh
 * halaman terbaca sebagai satu pola yang diulang-ulang. Di sini judulnya
 * menempel di kiri saat digulirkan sementara langkahnya berjalan turun di
 * kanan, dihubungkan satu garis tipis — bentuk yang sesuai dengan isinya,
 * karena langkah memang berurutan.
 *
 * Komponen server: tidak ada bagian di seksi ini yang perlu bereaksi terhadap
 * pengguna, jadi tidak perlu dikirim sebagai JavaScript.
 */

const STEPS = [
  {
    title: "Susun kata kunci",
    body: "Tulis frasa yang biasa dipakai calon pelanggan Anda, lengkap dengan kata negatif untuk menyingkirkan percakapan yang tidak relevan.",
  },
  {
    title: "Sistem mencari berkala",
    body: "Kata kunci dijalankan sesuai jadwal paket, tiap 5 jam pada paket Pro. Pencarian manual tetap bisa Anda jalankan kapan saja.",
  },
  {
    title: "Lead masuk dengan skor",
    body: "Setiap postingan yang cocok diberi skor relevansi 0–100 beserta alasan kecocokannya, lalu masuk ke feed ruang kerja Anda.",
  },
  {
    title: "Tinjau, lalu balas",
    body: "Draft balasan disiapkan dari profil bisnis dan isi postingan. Anda menyuntingnya seperlunya, lalu mengirim, atau menyerahkannya ke mode otomatis yang berpagar.",
  },
];

export function HowItWorks() {
  return (
    <section className="site-section" id="cara-kerja">
      <div className="container flow">
        <div className="flow__aside">
          <div className="site-head" data-reveal>
            <p className="site-eyebrow">Cara kerja</p>
            <h2 className="site-h2">Empat langkah, lalu tinggal menjaga ritmenya.</h2>
            <p className="site-lead">
              Penyiapan pertama memakan waktu beberapa menit. Setelah itu yang perlu Anda lakukan hanya meninjau apa
              yang masuk.
            </p>
          </div>
        </div>

        <ol className="flow__steps">
          {STEPS.map((step, index) => (
            <li className="flow__step" key={step.title} data-reveal>
              <span className="flow__marker" aria-hidden="true">{index + 1}</span>
              <div className="flow__text">
                <h3 className="site-h3">{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
