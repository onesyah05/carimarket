import type { Metadata } from "next";
import Link from "next/link";
import { Check, CircleDollarSign } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

export const metadata: Metadata = { title: "Harga beta", description: "Informasi akses beta Cari Market." };

export default function PricingPage() {
  return <><PublicHeader /><main><section className="page-hero"><div className="container"><p className="eyebrow">Akses beta</p><h1>Harga belum ditetapkan.</h1><p>Cari Market tersedia melalui akses beta tanpa biaya. Informasi paket akan diumumkan sebelum penagihan dimulai.</p></div></section><section className="content-page"><div className="container beta-pricing"><article className="beta-pricing__main"><CircleDollarSign size={28} /><h2>Yang tersedia sekarang</h2><ul className="plain-checks"><li><Check size={17} /> Membuat profil bisnis</li><li><Check size={17} /> Mengatur kata kunci dan eksklusi</li><li><Check size={17} /> Mengelola feed lead</li><li><Check size={17} /> Meninjau draft dan mengirim balasan manual</li></ul><Link className="button button--primary" href="/masuk">Masuk akses beta</Link></article><aside className="beta-pricing__note"><h2>Butuh akses untuk tim?</h2><p>Ceritakan jumlah anggota, aturan otomatisasi, dan kebutuhan pelaporan. Masukan Anda akan membantu membentuk paket tim.</p><Link className="text-link" href="/kontak">Hubungi tim produk</Link></aside></div></section></main><PublicFooter /></>;
}
