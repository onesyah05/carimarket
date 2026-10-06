import type { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { ContactForm } from "@/features/contact/components/contact-form";

export const metadata: Metadata = { title: "Kontak" };
export default function ContactPage() { return <><PublicHeader /><main><section className="page-hero"><div className="container"><p className="eyebrow">Hubungi tim produk</p><h1>Ceritakan cara tim Anda mengelola balasan.</h1><p>Kami ingin memahami volume pencarian, pilihan mode balasan, dan kebutuhan pelaporan Anda.</p></div></section><section className="content-page"><div className="container contact-grid"><div className="contact-info"><div><Mail /><h2>Email</h2><p>halo@carimarket.id</p></div><div><MapPin /><h2>Lokasi</h2><p>Jakarta, Indonesia</p></div></div><ContactForm /></div></section></main><PublicFooter /></>; }
