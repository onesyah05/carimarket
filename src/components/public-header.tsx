import Link from "next/link";
import { LayoutDashboard, LogIn, Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/lib/prisma";
import { homePathForRole } from "@/lib/redirects";
import { getSessionUser } from "@/server/auth/session";

const nav = [
  ["Cara kerja", "/#cara-kerja"],
  ["Fitur", "/#fitur"],
  ["Harga", "/harga"],
  ["Blog", "/blog"],
];

/**
 * Nama yang ditampilkan untuk pengunjung yang sudah masuk: nama bisnisnya
 * bila ada, karena itulah yang mereka kenali sebagai "akun saya"; nama orang
 * dipakai bila profil bisnis belum diisi.
 */
async function sessionIdentity() {
  const user = await getSessionUser();
  if (!user || user.status === "SUSPENDED") return null;

  const profile = user.role === "USER"
    ? await prisma.businessProfile.findUnique({ where: { userId: user.id }, select: { name: true } })
    : null;
  return { label: profile?.name?.trim() || user.name, href: homePathForRole(user.role) };
}

export async function PublicHeader() {
  const identity = await sessionIdentity();

  return (
    <header className="public-header">
      <div className="container public-header__inner">
        <BrandLogo />
        <nav className="public-nav" aria-label="Navigasi utama">
          {nav.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
        </nav>
        <div className="public-header__actions">
          <ThemeToggle />
          {identity
            ? <Link className="button button--primary public-header__account" href={identity.href}>
              <LayoutDashboard size={16} /> <span>{identity.label}</span>
            </Link>
            : <>
              <Link className="public-header__signin" href="/masuk"><LogIn size={16} /> Masuk</Link>
              <Link className="button button--primary public-header__login" href="/daftar">Daftar</Link>
            </>}
          <details className="mobile-menu">
            <summary aria-label="Buka menu"><Menu size={20} /></summary>
            <nav>
              {nav.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
              {identity
                ? <Link className="mobile-menu__login" href={identity.href}>{identity.label}</Link>
                : <>
                  <Link href="/masuk">Masuk ke akun</Link>
                  <Link className="mobile-menu__login" href="/daftar">Daftar gratis</Link>
                </>}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
