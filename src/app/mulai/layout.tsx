import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/features/auth/components/logout-button";

/**
 * Kerangka untuk langkah sebelum ruang kerja terbuka.
 *
 * Sengaja tanpa sidebar: belum ada yang dapat dibuka dari sini, dan menu yang
 * seluruhnya terkunci hanya memancing klik yang berakhir di halaman ini lagi.
 * Tombol keluar tetap ada supaya akun yang salah masuk tidak terjebak.
 */
export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="start-shell">
      <header className="start-shell__bar">
        <BrandLogo />
        <div className="start-shell__actions">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>
      <div className="start-shell__body">{children}</div>
    </main>
  );
}
