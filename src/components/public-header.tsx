import Link from "next/link";
import { Menu } from "lucide-react";
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
          <Link className="button button--ghost hide-mobile" href="/masuk">Masuk</Link>
          <Link className="button button--primary public-cta" href="/daftar">Buat akun</Link>
          <details className="mobile-menu">
            <summary aria-label="Buka menu"><Menu size={20} /></summary>
            <nav>
              {nav.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
              <Link href="/masuk">Masuk</Link>
              <Link href="/daftar">Buat akun</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
