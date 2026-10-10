"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { AccountForms, type Account } from "@/features/account/components/account-forms";
import { MobileDevices } from "@/features/settings/components/mobile-devices";

/**
 * Keamanan dan data workspace pengguna.
 *
 * Form identitas dan kata sandi dipakai bersama dengan profil akun internal,
 * sehingga aturannya tidak pernah berbeda antar role.
 */
export function SecuritySettings({ account }: { account?: Account }) {
  return <>
    <div className="panel-heading"><div><h2>Keamanan dan data</h2><p>Kelola identitas akun, kata sandi, aplikasi mobile, dan salinan data workspace Anda.</p></div></div>
    <div className="security-settings">
      <AccountForms initialAccount={account} />

      <div className="security-settings__mobile"><MobileDevices /></div>

      <div className="security-settings__data">
        <h3>Data workspace</h3>
        <p>Unduh profil bisnis, kata kunci, lead, dan riwayat draft Anda dalam format JSON. Token integrasi dan kata sandi tidak disertakan.</p>
        <a className="button button--ghost" href="/api/settings/data-export" download><Download size={17} /> Unduh data saya</a>
        <Link className="text-link" href="/penghapusan-data">Baca prosedur penghapusan data</Link>
      </div>
    </div>
  </>;
}
