import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format";

/**
 * Peringatan masa tenggang untuk akun lama yang belum memilih paket.
 *
 * Akun ini memakai Cari Market sebelum kewajiban memilih paket ada, jadi
 * aksesnya tidak dicabut mendadak. Peringatan menyebut tanggal pastinya,
 * bukan hanya "segera": orang perlu tahu kapan harus bertindak.
 */
export function GraceNotice({ daysLeft, endsAt }: { daysLeft: number; endsAt: string }) {
  return (
    <div className="internal-warning grace-notice">
      <AlertTriangle size={18} />
      <p>
        Akun Anda belum memiliki paket langganan. Akses ruang kerja tetap terbuka sampai{" "}
        <strong>{formatDate(endsAt)}</strong>{daysLeft > 0 ? ` (${daysLeft} hari lagi)` : ""}. Pilih paket sebelum
        tanggal itu agar pencarian dan balasan Anda tidak terhenti.{" "}
        <Link href="/mulai/paket">Pilih paket sekarang</Link>
      </p>
    </div>
  );
}
