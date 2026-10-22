import Link from "next/link";
import { LayoutDashboard, LogIn, Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderScrollState } from "@/components/header-scroll-state";
import { prisma } from "@/lib/prisma";
import { homePathForRole } from "@/lib/redirects";
import { getSessionUser } from "@/server/auth/session";

/**
 * Navigasi dipangkas dari enam tautan menjadi empat.
 *
 * Dua yang dibuang — "Demo Radar" dan "Kalkulator" — menunjuk ke seksi yang
 * memang dihapus pada revamp ini. Menu publik yang ramai adalah hal pertama
 * yang membuat halaman terasa menuntut, bukan tenang.
 */
const nav = [
  ["Cara kerja", "/#cara-kerja"],
  ["Fitur", "/#fitur"],
  ["Harga", "/harga"],
  ["Pertanyaan", "/#faq"],
];

/**
 * Nama yang ditampilkan untuk pengunjung yang sudah masuk: nama bisnisnya
 * bila ada, karena itulah yang mereka kenali sebagai "akun saya"; nama orang
 * dipakai bila profil bisnis belum diisi.
 *
 * Kegagalan database dianggap "belum masuk", bukan dibiarkan melempar. Seluruh
 * data halaman publik sudah dijaga dengan `.catch()`, tetapi header ini
 * sebelumnya tidak — jadi satu database yang tidak dapat dihubungi cukup untuk
 * menjatuhkan beranda, halaman harga, dan blog bagi pengunjung yang bahkan
 * tidak punya akun. Tombol "Masuk" tetap tampil dan tetap dapat diklik.
 */
async function sessionIdentity() {
  try {
    const user = await getSessionUser();
    if (!user || user.status === "SUSPENDED") return null;

    const profile =
      user.role === "USER"
        ? await prisma.businessProfile.findFirst({
            where: { userId: user.id },
            select: { name: true },
          })
        : null;
    return { label: profile?.name?.trim() || user.name, href: homePathForRole(user.role) };
  } catch (error) {
    console.warn(`Identitas sesi tidak dapat dibaca untuk header publik: ${error instanceof Error ? error.message.slice(0, 160) : "penyebab tidak diketahui"}`);
    return null;
  }
}

export async function PublicHeader() {
  const identity = await sessionIdentity();

  return (
    <header className="site-header" id="site-header">
      {/* Garis rambut di bawah header baru muncul setelah digulirkan. */}
      <HeaderScrollState />

      <div className="container site-header__inner">
        <div className="site-header__brand"><BrandLogo /></div>

        <nav className="site-nav" aria-label="Navigasi utama">
          {nav.map(([label, href]) => (
            <Link key={label} href={href} className="site-nav__link">{label}</Link>
          ))}
        </nav>

        <div className="site-header__actions">
          <ThemeToggle />

          {identity ? (
            <Link className="btn btn--primary" href={identity.href}>
              <LayoutDashboard size={16} /> <span>{identity.label}</span>
            </Link>
          ) : (
            <>
              <Link className="site-header__signin" href="/masuk">
                <LogIn size={15} /> Masuk
              </Link>
              <Link className="btn btn--primary" href="/daftar">Coba gratis</Link>
            </>
          )}

          <details className="site-menu">
            <summary aria-label="Buka menu navigasi"><Menu size={19} /></summary>
            <nav className="site-menu__panel">
              {nav.map(([label, href]) => (
                <Link key={label} href={href}>{label}</Link>
              ))}
              <hr />
              {identity ? (
                <Link className="is-primary" href={identity.href}>Buka dashboard</Link>
              ) : (
                <>
                  <Link href="/masuk">Masuk ke akun</Link>
                  <Link className="is-primary" href="/daftar">Coba gratis</Link>
                </>
              )}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
