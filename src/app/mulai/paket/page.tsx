import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { UpgradeCenter } from "@/features/billing/components/upgrade-center";
import { FreePlanCard } from "@/features/billing/components/free-plan-card";
import { requirePageUser } from "@/server/auth/page-guards";
import { hasActiveSubscription } from "@/server/auth/access-gate";
import { VERIFY_PATH } from "@/server/auth/access-rules";
import { getBillingOverview } from "@/server/billing/transactions";
import { findFreePlan } from "@/server/billing/free-plan";
import { homePathForRole } from "@/lib/redirects";
import { PLAN_CATALOG } from "../../../../prisma/plan-catalog";
import { describeQuota } from "@/server/plans/queries";

export const metadata: Metadata = { title: "Pilih paket", robots: { index: false, follow: false } };

/**
 * Gerbang terakhir sebelum ruang kerja: memilih paket.
 *
 * Halaman ini memakai pusat upgrade yang sama dengan halaman Langganan, jadi
 * aturan tagihan, kode unik, jendela pembayaran, dan unggah bukti hanya ada
 * satu versinya — bukan satu salinan untuk pendaftar baru dan satu lagi untuk
 * pelanggan lama.
 */
export default async function ChoosePlanPage() {
  const user = await requirePageUser("/mulai/paket");
  if (user.role !== "USER") redirect(homePathForRole(user.role));
  if (user.status === "PENDING_VERIFICATION") redirect(VERIFY_PATH);
  if (await hasActiveSubscription(user.id)) redirect("/dashboard");

  const [billing, freePlan] = await Promise.all([getBillingOverview(user.id), findFreePlan()]);
  const open = billing.openTransaction;
  const highlights = freePlan
    ? PLAN_CATALOG.find(entry => entry.code === freePlan.code)?.highlights
      ?? describeQuota({
        monthlySearchLimit: freePlan.monthlySearchLimit,
        monthlyReplyLimit: freePlan.monthlyReplyLimit,
        keywordLimit: freePlan.keywordLimit,
      })
    : [];

  return (
    <>
      <p className="eyebrow">Langkah terakhir</p>
      <h1>{open ? "Selesaikan pembayaran Anda" : "Pilih paket untuk membuka ruang kerja"}</h1>
      <p className="start-shell__copy">
        {open
          ? "Tagihan Anda sudah dibuat. Transfer sesuai nominal beserta kode uniknya, lalu tandai sudah membayar agar tim kami memverifikasi."
          : "Paket menentukan berapa banyak pencarian, balasan, dan kata kunci yang dapat Anda pakai tiap bulan. Semuanya bisa diubah nanti."}
      </p>

      {billing.paymentMethods.length === 0 && !freePlan && (
        <div className="internal-warning">
          <AlertTriangle size={18} />
          <p>Belum ada metode pembayaran aktif, jadi tagihan belum dapat dibuat. Hubungi dukungan agar kami bantu mengaktifkan akun Anda.</p>
        </div>
      )}

      {freePlan && !open && <FreePlanCard name={freePlan.name} highlights={highlights} />}

      <UpgradeCenter initial={billing} />
    </>
  );
}
