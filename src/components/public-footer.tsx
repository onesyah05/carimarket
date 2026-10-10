import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="container public-footer__simple">
        <div className="footer-brand"><BrandLogo /><p>Menemukan percakapan yang layak ditindaklanjuti.</p></div>
        <nav aria-label="Navigasi footer">
          <Link href="/harga">Harga</Link><Link href="/tentang">Tentang</Link><Link href="/kontak">Kontak</Link><Link href="/kebijakan-privasi">Privasi</Link><Link href="/syarat-ketentuan">Ketentuan</Link>
        </nav>
      </div>
      <div className="container footer-bottom"><span>© 2026 Cari Market</span><span>Social listening untuk bisnis Indonesia.</span></div>
    </footer>
  );
}
