import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Kerangka halaman akun (masuk, daftar, pemulihan sandi, verifikasi).
 *
 * Sebelumnya halaman ini memakai layar terbelah: bidang biru jenuh dengan
 * cincin kuning murni selebar 70px. Keduanya adalah sisa sistem "radar command
 * center" yang sudah ditinggalkan permukaan publik — kuning murni tidak pernah
 * menjadi bidang, hanya tanda kecil pada logo. Kolom tunggal di atas kertas
 * memakai token `--c-*` yang sama dengan beranda dan halaman harga, jadi
 * pengguna tidak berpindah ke dunia visual lain hanya untuk masuk.
 *
 * Logonya tetap menjadi tautan pulang: halaman akun adalah jalan buntu kalau
 * satu-satunya cara keluar adalah tombol mundur peramban.
 */
export function AuthShell({ children, title, copy }: { children: React.ReactNode; title: string; copy: string }) {
  return (
    <main className="auth">
      <div className="auth__bar">
        <Link href="/" aria-label="Beranda Cari Market"><BrandLogo /></Link>
      </div>
      <div className="auth__body">
        <div className="auth__intro">
          <h1>{title}</h1>
          <p>{copy}</p>
        </div>
        {children}
      </div>
      <footer className="auth__foot">
        <Link href="/syarat-ketentuan">Syarat &amp; ketentuan</Link>
        <Link href="/kebijakan-privasi">Kebijakan privasi</Link>
        <Link href="/kontak">Bantuan</Link>
      </footer>
    </main>
  );
}
