import { LogOut, ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { AccountForms } from "./account-forms";
import type { AccountOverview } from "@/server/settings/account";

/**
 * Profil akun internal (Admin dan Superadmin).
 *
 * Hanya memuat hal yang memang milik akun: identitas, kata sandi, role, dan
 * hak akses. Tidak ada pengaturan workspace bisnis di sini karena akun internal
 * tidak memiliki workspace.
 */
export function InternalProfile({ account }: { account: AccountOverview }) {
  return <div className="profile-layout">
    <section className="panel profile-summary">
      <div className="profile-summary__head">
        <span className="profile-avatar">{account.name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "CM"}</span>
        <div>
          <strong>{account.name}</strong>
          <span>{account.email ?? "Email belum diisi"}</span>
        </div>
      </div>
      <dl className="profile-meta">
        <div><dt>Role</dt><dd>{account.roleLabel}</dd></div>
        <div><dt>Status akun</dt><dd>{account.statusLabel}</dd></div>
        <div><dt>Email</dt><dd>{account.emailIsPlaceholder ? "Placeholder, belum dapat dihubungi" : account.emailVerified ? "Terverifikasi" : "Belum terverifikasi"}</dd></div>
        <div><dt>Kata sandi</dt><dd>{account.hasPassword ? "Sudah dibuat" : "Belum dibuat"}</dd></div>
        <div><dt>Masuk terakhir</dt><dd>{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "—"}</dd></div>
        <div><dt>Akun dibuat</dt><dd>{formatDateTime(account.createdAt)}</dd></div>
      </dl>

      {account.role === "ADMIN" && <div className="profile-permissions">
        <strong><ShieldCheck size={16} /> Hak akses</strong>
        {account.permissions.length > 0
          ? <ul>{account.permissions.map(permission => <li key={permission}>{permission}</li>)}</ul>
          : <p>Belum ada hak akses khusus. Superadmin dapat mengaturnya dari menu Manajemen Admin.</p>}
      </div>}

      {account.role === "SUPERADMIN" && <div className="profile-permissions">
        <strong><ShieldCheck size={16} /> Hak akses</strong>
        <p>Superadmin memiliki kendali penuh platform, termasuk billing, kredensial integrasi, dan penghapusan akun.</p>
      </div>}

      <div className="profile-logout">
        <span><LogOut size={15} /> Keluar dari sesi ini</span>
        <LogoutButton />
      </div>
    </section>

    <section className="panel profile-forms">
      <AccountForms />
    </section>
  </div>;
}
