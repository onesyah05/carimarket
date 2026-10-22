import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { JsonLd } from "@/components/json-ld";
import { organizationSchema, siteUrl } from "@/lib/seo";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Cari Market | Temukan lead dari Threads", template: "%s | Cari Market" },
  description: "Temukan percakapan Threads yang relevan, siapkan balasan yang manusiawi, dan ubah sinyal menjadi peluang bisnis.",
  applicationName: "Cari Market",
  icons: { icon: "/logo-carimarket.png", apple: "/logo-carimarket-square.jpg" },
  openGraph: {
    title: "Cari Market",
    description: "Temukan lead dari percakapan publik di Threads.",
    type: "website",
    locale: "id_ID",
    siteName: "Cari Market",
    url: siteUrl(),
  },
  // Gambarnya diisi otomatis dari `opengraph-image.tsx`; di sini hanya bentuk
  // kartunya yang ditentukan, supaya tautan tidak tampil sebagai kartu kecil.
  twitter: {
    card: "summary_large_image",
    title: "Cari Market",
    description: "Temukan lead dari percakapan publik di Threads.",
  },
};

/**
 * Tema dipasang sebelum cat pertama.
 *
 * Sebelumnya `data-theme` hanya disetel oleh efek di dalam ThemeToggle, jadi
 * halaman yang tidak memuat tombol itu — seluruh onboarding dan halaman akun —
 * selalu tampil terang meski pengguna memilih gelap, dan halaman yang
 * memuatnya berkedip terang dulu sebelum berganti. Skrip ini berjalan sinkron
 * di dalam <head> sehingga atributnya sudah benar saat elemen pertama digambar.
 */
const themeScript = `(function(){try{var t=localStorage.getItem("carimarket-theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body suppressHydrationWarning className={jakarta.variable}>
    {children}
    {/* Satu Organization untuk seluruh situs; halaman lain merujuk @id ini. */}
    <JsonLd data={organizationSchema()} />
  </body></html>;
}

