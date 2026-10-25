import Link from "next/link";
import { Check } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import type { PublicPlan } from "@/server/plans/queries";

/**
 * Ringkasan paket di beranda.
 *
 * Angkanya dibaca dari database yang sama dengan halaman harga, jadi beranda
 * tidak pernah menampilkan harga lama setelah Superadmin mengubahnya. Hanya
 * tiga sorotan teratas yang ditampilkan — perbandingan lengkap tempatnya di
 * halaman harga, bukan di sini.
 */
export function PlanPreview({ plans }: { plans: PublicPlan[] }) {
  if (plans.length === 0) return null;

  return (
    <section className="site-section site-section--sunken" id="harga">
      <div className="container">
        <div className="site-head" data-reveal>
          <p className="site-eyebrow">Paket</p>
          <h2 className="site-h2">Mulai gratis, naik saat lead-nya memang sudah ramai.</h2>
          <p className="site-lead">
            Kuota tertulis sejak awal dan ditegakkan di server. Paket berbayar diaktifkan tim setelah pembayaran
            diverifikasi. Belum ada penagihan otomatis, dan kami menyebutkannya apa adanya.
          </p>
        </div>

        <div className="plans">
          {plans.map(plan => (
            <article className={`plan ${plan.featured ? "plan--featured" : ""}`} key={plan.code} data-reveal>
              <h3 className="site-h3">{plan.name}</h3>
              <p className="plan__price">
                {formatRupiah(plan.monthlyPrice)}
                {plan.monthlyPrice > 0 && <small> / bulan</small>}
              </p>
              <p className="site-note">{plan.tagline}</p>
              <ul className="plan__list">
                {plan.highlights.slice(0, 3).map(item => (
                  <li key={item}><Check size={14} aria-hidden="true" /> <span>{item}</span></li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="site-note" style={{ marginTop: "22px" }}>
          <Link className="text-link" href="/harga">Lihat perbandingan kuota lengkap →</Link>
        </p>
      </div>
    </section>
  );
}
