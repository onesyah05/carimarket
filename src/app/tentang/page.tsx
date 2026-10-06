import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

export const metadata: Metadata = { title: "Tentang Kami" };
export default function AboutPage() { return <><PublicHeader /><main><section className="page-hero"><div className="container"><p className="eyebrow">Tentang Cari Market</p><h1>Peluang yang baik dimulai dari mendengar.</h1><p>Cari Market membantu bisnis Indonesia menemukan momen ketika produk atau layanan mereka benar-benar dibutuhkan.</p></div></section><section className="content-page"><div className="content-narrow"><h2>Misi kami</h2><p>Membuat social listening terasa praktis untuk bisnis kecil dan menengah tanpa mengorbankan kualitas percakapan atau kepercayaan pengguna.</p><h2>Prinsip produk</h2><p>Otomasi harus menghemat waktu tanpa menghilangkan kendali. Pengguna dapat meninjau setiap draft atau mengotomatiskan balasan yang lolos aturan, sementara draft berisiko tetap ditahan.</p></div></section></main><PublicFooter /></>; }
