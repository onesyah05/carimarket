import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Footer tanpa lencana status dan tanpa klaim peringkat.
 *
 * Versi sebelumnya menyebut diri "platform radar social listening B2B pertama
 * di Indonesia" dan memasang indikator "Semua Sistem Normal" yang tidak
 * terhubung ke pemantauan apa pun. Keduanya dibuang: yang pertama tidak dapat
 * dibuktikan, yang kedua indikator palsu.
 */
export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <BrandLogo />
          <p>
            Menemukan percakapan publik di Threads yang relevan dengan layanan Anda, lalu menyiapkan draft balasan
            yang tetap Anda kendalikan.
          </p>
        </div>

        <div className="site-footer__col">
          <h3>Produk</h3>
          <Link href="/#cara-kerja">Cara kerja</Link>
          <Link href="/#fitur">Fitur</Link>
          <Link href="/harga">Paket &amp; harga</Link>
          <Link href="/#faq">Pertanyaan umum</Link>
        </div>

        <div className="site-footer__col">
          <h3>Perusahaan</h3>
          <Link href="/tentang">Tentang kami</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/kontak">Hubungi tim</Link>
        </div>

        <div className="site-footer__col">
          <h3>Kepatuhan</h3>
          <Link href="/kebijakan-privasi">Kebijakan privasi</Link>
          <Link href="/syarat-ketentuan">Syarat &amp; ketentuan</Link>
          <Link href="/penghapusan-data">Penghapusan data</Link>
        </div>
      </div>

      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} Cari Market</span>
        <span>Dibuat untuk pemilik bisnis dan agensi di Indonesia</span>
      </div>
    </footer>
  );
}
