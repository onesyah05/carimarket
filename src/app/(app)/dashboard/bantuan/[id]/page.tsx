import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketThread } from "@/features/support/components/ticket-thread";
import { requirePageRole } from "@/server/auth/page-guards";
import { requireTicketForUser } from "@/server/support/tickets";

export const metadata: Metadata = { title: "Tiket dukungan", robots: { index: false, follow: false } };

/**
 * Satu tiket, satu alamat.
 *
 * Kepemilikannya diperiksa di server lewat `requireTicketForUser`, jadi id
 * tiket milik orang lain berakhir sebagai 404 dan bukan sebagai halaman kosong
 * yang membocorkan bahwa tiket itu ada.
 */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole(["USER"], `/dashboard/bantuan/${id}`);
  const ticket = await requireTicketForUser(user.id, id).catch(() => null);
  if (!ticket) notFound();
  return <TicketThread ticket={ticket} />;
}
