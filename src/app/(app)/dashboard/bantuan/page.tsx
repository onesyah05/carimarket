import type { Metadata } from "next";
import { PageHeading } from "@/components/dashboard-ui";
import { SupportCenter } from "@/features/support/components/support-center";
import { requirePageRole } from "@/server/auth/page-guards";
import { listMyTickets } from "@/server/support/tickets";

export const metadata: Metadata = { title: "Bantuan", robots: { index: false, follow: false } };

/**
 * Halaman ini sengaja berada di luar grup `(ready)`, sejajar dengan Pengaturan:
 * orang yang tersangkut di tengah onboarding justru yang paling perlu bertanya.
 */
export default async function SupportPage() {
  const user = await requirePageRole(["USER"], "/dashboard/bantuan");
  return <>
    <PageHeading
      eyebrow="Dukungan"
      title="Bantuan"
      copy="Buka tiket untuk kendala teknis, pertanyaan kuota, atau pembayaran yang belum terverifikasi. Balasan tim muncul di sini dan di notifikasi Anda."
    />
    <SupportCenter tickets={await listMyTickets(user.id)} emailReachable={!user.emailIsPlaceholder} />
  </>;
}
