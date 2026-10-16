import Link from "next/link";
import { LogIn, Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  ["Cara kerja", "/#cara-kerja"],
  ["Fitur", "/#fitur"],
  ["Harga", "/harga"],
  ["Blog", "/blog"],
];

export function PublicHeader() {
  return (
    <header className="public-header">
      <div className="container public-header__inner">
        <BrandLogo />
        <nav className="public-nav" aria-label="Navigasi utama">
          {nav.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
        </nav>
        <div className="public-header__actions">
          <ThemeToggle />
          {/* Pengunjung yang sudah punya sesi langsung diantar halaman masuk ke dashboardnya. */}
          <Link className="public-header__signin" href="/masuk"><LogIn size={16} /> Masuk</Link>
          <Link className="button button--primary public-header__login" href="/daftar">Daftar</Link>
          <details className="mobile-menu">
            <summary aria-label="Buka menu"><Menu size={20} /></summary>
            <nav>
              {nav.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
              <Link href="/masuk">Masuk ke akun</Link>
              <Link className="mobile-menu__login" href="/daftar">Daftar gratis</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
