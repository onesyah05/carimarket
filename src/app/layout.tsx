import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "Cari Market | Temukan lead dari Threads", template: "%s | Cari Market" },
  description: "Temukan percakapan Threads yang relevan, siapkan balasan yang manusiawi, dan ubah sinyal menjadi peluang bisnis.",
  icons: { icon: "/logo-carimarket.png", apple: "/logo-carimarket-square.jpg" },
  openGraph: { title: "Cari Market", description: "Temukan lead dari percakapan publik di Threads.", type: "website", locale: "id_ID" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body suppressHydrationWarning className={jakarta.variable}>{children}</body></html>;
}
