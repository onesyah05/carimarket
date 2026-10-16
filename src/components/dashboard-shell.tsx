"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BookOpen, CircleHelp, CreditCard, Landmark, Receipt, FileCheck2, FileText, Gauge, History, KeyRound, LayoutDashboard, Mail, Menu, MessageSquareText, Plug, Search, Settings, ShieldCheck, Smartphone, Tags, UserCog, Users, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { useState } from "react";

type NavItem = { label: string; href: string; icon: LucideIcon };
/**
 * Menu dikelompokkan agar panjangnya dapat dipindai, bukan dibaca satu per
 * satu. Judul kelompok menjawab "di mana saya mencari ini", sehingga daftar
 * Superadmin yang panjang tetap terbaca secepat daftar pengguna yang pendek.
 */
type NavGroup = { caption: string; items: NavItem[] };

const userNav: NavGroup[] = [
  {
    caption: "Pekerjaan harian",
    items: [
      { label: "Ringkasan", href: "/dashboard", icon: LayoutDashboard },
      { label: "Lead", href: "/dashboard/leads", icon: Search },
      { label: "Kata kunci", href: "/dashboard/kata-kunci", icon: Tags },
      { label: "Balasan", href: "/dashboard/balasan", icon: MessageSquareText },
      { label: "Riwayat", href: "/dashboard/riwayat", icon: History },
    ],
  },
  {
    caption: "Akun",
    items: [
      { label: "Langganan", href: "/dashboard/langganan", icon: CreditCard },
      { label: "Pengaturan", href: "/dashboard/pengaturan", icon: Settings },
    ],
  },
];

const adminNav: NavGroup[] = [
  {
    caption: "Operasional",
    items: [
      { label: "Ringkasan", href: "/admin", icon: LayoutDashboard },
      { label: "Pengguna", href: "/admin/pengguna", icon: Users },
      { label: "Tiket", href: "/admin/tiket", icon: CircleHelp },
      { label: "Moderasi", href: "/admin/moderasi", icon: ShieldCheck },
      { label: "Monitoring", href: "/admin/monitoring", icon: Gauge },
    ],
  },
  {
    caption: "Publikasi",
    items: [
      { label: "Draft konten", href: "/admin/konten", icon: BookOpen },
    ],
  },
];

const superNav: NavGroup[] = [
  {
    caption: "Ikhtisar",
    items: [
      { label: "Metrik", href: "/superadmin", icon: LayoutDashboard },
      { label: "Cari lead", href: "/superadmin/cari-lead", icon: Search },
      { label: "Audit", href: "/superadmin/audit", icon: FileText },
    ],
  },
  {
    caption: "Akun",
    items: [
      { label: "Admin", href: "/superadmin/admin", icon: ShieldCheck },
      { label: "Pengguna", href: "/superadmin/users", icon: Users },
    ],
  },
  {
    caption: "Pendapatan",
    items: [
      { label: "Paket & billing", href: "/superadmin/paket", icon: CreditCard },
      { label: "Pembayaran", href: "/superadmin/pembayaran", icon: Receipt },
      { label: "Metode pembayaran", href: "/superadmin/metode-pembayaran", icon: Landmark },
    ],
  },
  {
    caption: "Konten & kepatuhan",
    items: [
      { label: "CMS", href: "/superadmin/konten", icon: BookOpen },
      { label: "Kepatuhan", href: "/superadmin/kepatuhan", icon: FileCheck2 },
      { label: "Pesan kontak", href: "/superadmin/kontak", icon: Mail },
    ],
  },
  {
    caption: "Platform",
    items: [
      { label: "Sistem", href: "/superadmin/sistem", icon: KeyRound },
      { label: "Integrasi", href: "/superadmin/integrasi", icon: Plug },
      { label: "Kuota API", href: "/superadmin/kuota", icon: Gauge },
      { label: "API Mobile", href: "/superadmin/api", icon: Smartphone },
    ],
  },
];

/** Hanya halaman muka tiap peran yang dicocokkan persis; sisanya per awalan. */
function isActivePath(pathname: string, href: string) {
  const exact = href === "/dashboard" || href === "/admin" || href === "/superadmin";
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({ children, user }: { children: React.ReactNode; user: { name: string; workspace: string; role: "user" | "admin" | "superadmin" } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { role, name, workspace } = user;
  const nav = role === "user" ? userNav : role === "admin" ? adminNav : superNav;
  const initials = name.split(" ").map(part => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const isSuperadmin = role === "superadmin";
  const isUser = role === "user";
  const quickLink = isSuperadmin ? "/superadmin/users" : role === "admin" ? "/admin/tiket" : "/dashboard/leads";
  // Label kerja, bukan placeholder: tautan ini membuka halaman, bukan kolom
  // yang bisa diketik.
  const quickLabel = isSuperadmin ? "Kelola pengguna" : role === "admin" ? "Tiket dukungan" : "Buka feed lead";
  const notificationLink = isSuperadmin ? "/superadmin/audit" : role === "admin" ? "/admin/moderasi" : "/dashboard/balasan";
  const notificationLabel = isSuperadmin ? "Buka audit log" : role === "admin" ? "Buka moderasi" : "Buka balasan";
  const accountLink = isSuperadmin ? "/superadmin/profil" : role === "admin" ? "/admin/profil" : "/dashboard/pengaturan";
  const accountLabel = isUser ? "Pengaturan akun" : "Profil akun";

  // Admin memakai kerangka internal yang sama dengan Superadmin: tabel, kartu
  // metrik, dan jarak panelnya satu aturan, bukan dua tampilan berbeda.
  return <div className={`app-shell ${isUser ? "app-shell--user" : "app-shell--internal"}`}>
    <aside className={`app-sidebar ${open ? "app-sidebar--open" : ""}`}>
      <div className="sidebar-brand"><BrandLogo /><button onClick={() => setOpen(false)} aria-label="Tutup menu"><X size={20} /></button></div>
      <div className="workspace-chip"><span>{initials}</span><div><strong>{workspace}</strong><small>{role === "user" ? "Workspace bisnis" : "Workspace internal"}</small></div></div>
      <nav className="app-nav" aria-label="Navigasi dashboard">
        {nav.map(group => <div className="app-nav__group" key={group.caption}>
          <p className="app-nav__caption">{group.caption}</p>
          {group.items.map(item => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
              <Icon size={18} /><span>{item.label}</span>
            </Link>;
          })}
        </div>)}
      </nav>
      {isUser && <div className="sidebar-help"><div><CircleHelp size={18} /><strong>Butuh bantuan?</strong></div><p>Tim kami siap membantu setup pencarian pertama Anda.</p><Link href="/kontak">Hubungi dukungan</Link></div>}
      <Link className="sidebar-profile" href={accountLink} onClick={() => setOpen(false)}>
        <span>{initials}</span>
        <div><strong>{name}</strong><small>{accountLabel}</small></div>
        <UserCog size={16} />
      </Link>
      <LogoutButton />
    </aside>
    {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Tutup navigasi" />}
    <div className="app-main">
      <header className="app-topbar"><button className="menu-button" onClick={() => setOpen(true)} aria-label="Buka menu"><Menu size={21} /></button><Link className="top-action" href={quickLink}><Search size={16} /><span>{quickLabel}</span></Link><ThemeToggle /><NotificationBell enabled={isUser} fallbackHref={notificationLink} fallbackLabel={notificationLabel} fallbackCopy={isSuperadmin ? "Aktivitas penting platform dapat ditinjau melalui audit log." : "Periksa antrean moderasi untuk tindakan yang menunggu keputusan."} /></header>
      <div className="app-content">{children}</div>
    </div>
  </div>;
}
