"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BookOpen, CircleHelp, CreditCard, FileCheck2, FileText, Gauge, History, KeyRound, LayoutDashboard, Mail, Menu, MessageSquareText, Plug, Search, Settings, ShieldCheck, Smartphone, Tags, UserCog, Users, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { useState } from "react";

type NavItem = { label: string; href: string; icon: LucideIcon };

const userNav: NavItem[] = [
  { label: "Ringkasan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Lead", href: "/dashboard/leads", icon: Search },
  { label: "Kata kunci", href: "/dashboard/kata-kunci", icon: Tags },
  { label: "Balasan", href: "/dashboard/balasan", icon: MessageSquareText },
  { label: "Riwayat", href: "/dashboard/riwayat", icon: History },
  { label: "Langganan", href: "/dashboard/langganan", icon: CreditCard },
  { label: "Pengaturan", href: "/dashboard/pengaturan", icon: Settings },
];

const adminNav: NavItem[] = [
  { label: "Ringkasan", href: "/admin", icon: LayoutDashboard },
  { label: "Tiket", href: "/admin/tiket", icon: CircleHelp },
  { label: "Moderasi", href: "/admin/moderasi", icon: ShieldCheck },
  { label: "Monitoring", href: "/admin/monitoring", icon: Gauge },
  { label: "Konten", href: "/admin/konten", icon: BookOpen },
  { label: "Profil", href: "/admin/profil", icon: UserCog },
];

const superNav: NavItem[] = [
  { label: "Metrik", href: "/superadmin", icon: LayoutDashboard },
  { label: "Admin", href: "/superadmin/admin", icon: ShieldCheck },
  { label: "Pengguna", href: "/superadmin/users", icon: Users },
  { label: "Paket & billing", href: "/superadmin/paket", icon: CreditCard },
  { label: "Kuota API", href: "/superadmin/kuota", icon: Gauge },
  { label: "Kepatuhan", href: "/superadmin/kepatuhan", icon: FileCheck2 },
  { label: "Sistem", href: "/superadmin/sistem", icon: KeyRound },
  { label: "Integrasi", href: "/superadmin/integrasi", icon: Plug },
  { label: "API Mobile", href: "/superadmin/api", icon: Smartphone },
  { label: "Pesan kontak", href: "/superadmin/kontak", icon: Mail },
  { label: "Audit", href: "/superadmin/audit", icon: FileText },
  { label: "CMS", href: "/superadmin/konten", icon: BookOpen },
  { label: "Profil", href: "/superadmin/profil", icon: UserCog },
];

export function DashboardShell({ children, user }: { children: React.ReactNode; user: { name: string; workspace: string; role: "user" | "admin" | "superadmin" } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { role, name, workspace } = user;
  const nav = role === "user" ? userNav : role === "admin" ? adminNav : superNav;
  const initials = name.split(" ").map(part => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const isSuperadmin = role === "superadmin";
  const isUser = role === "user";
  const quickLink = isSuperadmin ? "/superadmin/users" : role === "admin" ? "/admin/tiket" : "/dashboard/leads";
  const quickLabel = isSuperadmin ? "Kelola pengguna" : role === "admin" ? "Lihat tiket dukungan" : "Cari lead atau kata kunci";
  const notificationLink = isSuperadmin ? "/superadmin/audit" : role === "admin" ? "/admin/moderasi" : "/dashboard/balasan";
  const notificationLabel = isSuperadmin ? "Buka audit log" : role === "admin" ? "Buka moderasi" : "Buka balasan";

  return <div className={`app-shell ${isSuperadmin ? "app-shell--superadmin" : isUser ? "app-shell--user" : ""}`}>
    <aside className={`app-sidebar ${open ? "app-sidebar--open" : ""}`}>
      <div className="sidebar-brand"><BrandLogo /><button onClick={() => setOpen(false)} aria-label="Tutup menu"><X size={20} /></button></div>
      <div className="workspace-chip"><span>{initials}</span><div><strong>{workspace}</strong><small>{role === "user" ? "Workspace bisnis" : "Workspace internal"}</small></div></div>
      <nav className="app-nav" aria-label="Navigasi dashboard">{nav.map(item => { const Icon = item.icon; const exact = item.href === "/dashboard" || item.href === "/admin" || item.href === "/superadmin"; const active = exact ? pathname === item.href : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}><Icon size={18} /><span>{item.label}</span></Link>; })}</nav>
      {!isSuperadmin && <div className="sidebar-help"><div><CircleHelp size={18} /><strong>Butuh bantuan?</strong></div><p>Tim kami siap membantu setup pencarian pertama Anda.</p><Link href="/kontak">Hubungi dukungan</Link></div>}
      <div className="sidebar-profile"><span>{initials}</span><div><strong>{name}</strong><small>{workspace}</small></div></div>
      <LogoutButton />
    </aside>
    {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Tutup navigasi" />}
    <div className="app-main">
      <header className="app-topbar"><button className="menu-button" onClick={() => setOpen(true)} aria-label="Buka menu"><Menu size={21} /></button><Link className="top-search" href={quickLink}><Search size={17} /><span>{quickLabel}</span></Link><ThemeToggle /><NotificationBell enabled={isUser} fallbackHref={notificationLink} fallbackLabel={notificationLabel} fallbackCopy={isSuperadmin ? "Aktivitas penting platform dapat ditinjau melalui audit log." : "Periksa antrean moderasi untuk tindakan yang menunggu keputusan."} /></header>
      <div className="app-content">{children}</div>
    </div>
  </div>;
}
