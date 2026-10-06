import Link from "next/link";
import { Bot, Check, Gauge, MapPin, MessageSquareText, Search, ShieldCheck, UserCheck } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

const workflow = [
  ["01", "Jelaskan bisnis Anda", "Isi layanan, area, dan gaya komunikasi agar hasil punya konteks."],
  ["02", "Atur kata kunci", "Gabungkan istilah kebutuhan, lokasi, dan kata yang ingin dikecualikan."],
  ["03", "Tinjau percakapan", "Baca sumber asli dan nilai apakah orang tersebut benar-benar membutuhkan bantuan."],
  ["04", "Pilih cara membalas", "Tinjau setiap draft atau siapkan pengiriman otomatis dengan batas dan aturan yang Anda tentukan."],
];

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main>
        <section className="hero hero--refined">
          <div className="container hero__grid">
            <div className="hero__copy">
              <p className="eyebrow">Pencarian lead dari percakapan Threads</p>
              <h1>Temukan orang yang sedang mencari <span>layanan Anda.</span></h1>
              <p>Cari Market menemukan postingan yang cocok, menyiapkan draft, lalu memprosesnya sesuai pilihan Anda: tinjau terlebih dahulu atau balas otomatis dengan aturan yang terkontrol. Pengiriman otomatis baru berjalan setelah integrasi resmi Meta tersedia; selama itu, draft siap dikirim manual.</p>
              <div className="hero__actions"><Link className="button button--primary" href="/daftar">Buat akun</Link><Link className="text-link" href="/#cara-kerja">Pelajari alurnya</Link></div>
              <p className="hero__note"><ShieldCheck size={17} /> Anda menentukan kapan balasan perlu ditinjau dan kapan boleh berjalan otomatis.</p>
            </div>
            <div className="hero__visual" aria-label="Pratinjau tampilan lead Cari Market">
              <div className="lead-preview">
                <div className="preview-top"><strong>Alur balasan</strong></div>
                <div className="preview-search"><Search size={14} /> jasa drone + BSD</div>
                <div className="preview-card preview-card--focus">
                  <div className="preview-person"><span className="preview-avatar">LV</span><div><strong>Langit Visual</strong><span>@langitvisual · 12 menit</span></div></div>
                  <p>Ada rekomendasi jasa drone untuk dokumentasi progres proyek di daerah BSD? Butuh minggu ini.</p>
                  <div className="preview-meta"><span className="match-chip">96% relevan</span><span className="status-chip">Otomatis dalam 15 menit</span></div>
                </div>
                <div className="preview-draft"><Bot size={17} /><div><strong>Mode otomatis terkontrol</strong><span>Aktif setelah integrasi resmi; untuk sementara draft dikirim manual.</span></div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section product-status">
          <div className="container product-status__grid">
            <div><p className="eyebrow">Kondisi produk saat ini</p><h2 className="section-title">Jelas mana yang bisa dipakai sekarang.</h2></div>
            <div className="status-list">
              <div><Check size={18} /><p><strong>Siap dikonfigurasi</strong><span>Profil bisnis, kata kunci, feed lead, serta pilihan tinjau dulu atau balas otomatis.</span></p></div>
              <div><Search size={18} /><p><strong>Pencarian aktif</strong><span>Pencarian postingan publik di Threads sudah berjalan untuk kata kunci yang Anda atur.</span></p></div>            </div>
          </div>
        </section>

        <section className="section section--soft" id="cara-kerja">
          <div className="container workflow-layout">
            <div className="section-heading section-heading--stacked"><p className="eyebrow">Alur kerja</p><h2 className="section-title">Dari pencarian hingga balasan, sesuai cara kerja Anda.</h2><p className="section-copy">Gunakan pemeriksaan manual saat ingin mengontrol setiap kata, lalu beralih ke otomatisasi ketika aturan dan batasnya sudah siap.</p></div>
            <ol className="workflow-list">{workflow.map(([number, title, copy]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol>
          </div>
        </section>

        <section className="section" id="fitur">
          <div className="container feature-story">
            <div className="feature-story__copy">
              <p className="eyebrow">Mode yang dapat diatur</p><h2 className="section-title">Tetap pegang kendali, tanpa harus selalu hadir.</h2><p>Pilih mode yang sesuai dengan kematangan alur bisnis. Pengaturan dapat diubah kapan saja tanpa mengubah kata kunci atau profil Anda.</p>
              <ul className="plain-checks"><li><UserCheck size={17} /> Tinjau dulu untuk memeriksa setiap draft</li><li><Bot size={17} /> Balas otomatis untuk lead yang lolos aturan</li><li><ShieldCheck size={17} /> Draft berisiko selalu dapat dialihkan ke review</li></ul>
              <p className="section-copy">Saat ini pencarian sudah aktif, sedangkan pengiriman balasan otomatis baru berjalan setelah integrasi resmi Meta tersedia. Selama itu, draft tetap dibuat dan siap Anda kirim secara manual.</p>
            </div>
            <div className="approval-preview automation-preview">
              <div className="approval-preview__header"><span>Mode balasan workspace</span><span className="context-label">Dapat diubah</span></div>
              <div className="landing-mode-option"><UserCheck /><div><strong>Tinjau dulu</strong><span>Setiap draft menunggu persetujuan Anda.</span></div></div>
              <div className="landing-mode-option active"><Bot /><div><strong>Balas otomatis</strong><span>Untuk lead yang memenuhi seluruh aturan; aktif setelah integrasi resmi.</span></div><Check size={17} /></div>
              <div className="landing-safety-list"><span><Gauge size={15} /> Maksimal 10 balasan per hari</span><span><ShieldCheck size={15} /> Relevansi minimal 90%</span><span><MessageSquareText size={15} /> Jeda pengiriman 15 menit</span></div>
              <Link className="button button--primary" href="/daftar">Atur mode balasan</Link>
            </div>
          </div>
        </section>

        <section className="section section--soft">
          <div className="container usecase-layout">
            <div><p className="eyebrow">Kapan produk ini berguna</p><h2 className="section-title">Saat calon pelanggan sudah menjelaskan kebutuhannya.</h2></div>
            <div className="usecase-rows"><article><MapPin /><div><h3>Layanan berbasis lokasi</h3><p>Menemukan permintaan yang menyebut kota, area, atau venue tertentu.</p></div></article><article><Search /><div><h3>Layanan yang jarang dicari lewat iklan</h3><p>Memantau bahasa sehari-hari yang tidak selalu cocok dengan kata kunci iklan.</p></div></article><article><MessageSquareText /><div><h3>Penjualan yang butuh konteks</h3><p>Membaca percakapan lebih dulu sebelum menawarkan bantuan yang relevan.</p></div></article></div>
          </div>
        </section>

        <section className="section beta-access"><div className="container beta-access__inner"><div><p className="eyebrow">Akses beta</p><h2 className="section-title">Harga belum ditetapkan.</h2><p>Daftar untuk menyiapkan workspace dan menjadi bagian dari akses awal Cari Market.</p></div><div><Link className="button button--primary" href="/daftar">Daftar akses beta</Link><Link className="text-link" href="/harga">Baca kebijakan harga beta</Link></div></div></section>

        <section className="section"><div className="container faq-layout"><div><p className="eyebrow">Pertanyaan sebelum mencoba</p><h2 className="section-title">Batas produknya kami jelaskan sejak awal.</h2></div><div className="faq-list"><Faq q="Apakah balasan harus diperiksa satu per satu?" a="Mode Tinjau dulu memeriksa setiap draft satu per satu. Mode Balas otomatis memproses draft yang lolos ambang relevansi dan aturan keamanan workspace, dan baru berjalan setelah integrasi resmi Meta tersedia. Selama itu, seluruh draft siap Anda kirim manual." /><Faq q="Apa yang terjadi jika draft otomatis berisiko?" a="Draft dapat ditahan dan dialihkan ke antrian tinjauan. Anda juga dapat mengatur batas harian serta jeda sebelum pengiriman." /><Faq q="Apakah pencarian postingan publik sudah aktif?" a="Ya. Pencarian berjalan di seluruh Threads untuk kata kunci yang Anda atur, dan hasilnya masuk ke feed lead untuk ditinjau atau dibalas." /></div></div></section>

        <section className="container cta-band"><div><h2>Mulai manual, otomatis saat Anda siap.</h2><p>Buat profil bisnis, atur kata kunci, lalu pilih cara balasan diproses.</p></div><Link className="button button--accent" href="/daftar">Buat akun</Link></section>
      </main>
      <PublicFooter />
    </>
  );
}

function Faq({ q, a }: { q: string; a: string }) { return <details><summary>{q}</summary><p>{a}</p></details>; }
