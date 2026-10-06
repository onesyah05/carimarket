import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Atur ulang kata sandi" };

export default function ForgotPasswordPage() {
  return <AuthShell title="Atur ulang akses akun." copy="Masukkan email yang terhubung ke workspace Cari Market."><div className="auth-card"><h2>Minta tautan pengaturan ulang</h2><form className="form-grid" action="/masuk"><div className="field"><label htmlFor="email">Email akun</label><input className="input" id="email" name="email" type="email" placeholder="nama@bisnis.id" required /></div><button className="button button--primary" type="submit">Lanjutkan</button></form><p className="auth-note">Pengiriman email pemulihan memerlukan konfigurasi layanan email.</p><Link className="text-link" href="/masuk">Kembali ke halaman masuk</Link></div></AuthShell>;
}
