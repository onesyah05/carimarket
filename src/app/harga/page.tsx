import type { Metadata } from "next";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { formatRupiah } from "@/lib/format";
import { listPublicPlans, type PublicPlan } from "@/server/plans/queries";
import { PLAN_CATALOG } from "../../../prisma/plan-catalog";

/**
 * Harga dibaca dari database agar dapat diubah tanpa deploy, tetapi halaman
 * tetap di-cache lima menit supaya halaman publik tidak memukul database pada
 * setiap kunjungan.
 */
export const revalidate = 300;

const paidPlans = PLAN_CATALOG.filter(plan => plan.monthlyPrice > 0)
  .map(plan => `${plan.name} ${formatRupiah(plan.monthlyPrice)}`)
  .join(", ");

export const metadata: Metadata = {
  title: "Harga",
  description: `Paket Cari Market: gratis untuk mencoba, lalu ${paidPlans} per bulan. Kuota pencarian dan balasan jelas sejak awal.`,
};

const FAQ = [
  {
    q: "Bagaimana kuota dihitung?",
    a: "Satu pencarian dihitung setiap kali sebuah kata kunci dijalankan, baik manual maupun terjadwal. Satu balasan dihitung saat balasan benar-benar terkirim ke Threads. Kuota berjalan per bulan kalender dan direset setiap awal bulan.",
  },
  {
    q: "Apa yang terjadi jika kuota habis?",
    a: "Pencarian dan pengiriman balasan baru ditolak sampai periode berikutnya, sedangkan data lead dan draft yang sudah ada tetap dapat dibuka. Peringatan muncul saat pemakaian mencapai 80 persen.",
  },
  {
    q: "Apakah batas ini terkait batas Meta?",
    a: "Ya. Meta membatasi 2.200 permintaan pencarian kata kunci per 24 jam dan sekitar 1.000 balasan per 24 jam untuk setiap akun Threads yang terhubung. Kuota paket dipilih agar tetap berada di bawah batas tersebut.",
  },
  {
    q: "Bisakah berpindah paket?",
    a: "Bisa. Hubungi tim melalui halaman kontak dan paket workspace Anda akan disesuaikan. Penagihan otomatis belum tersedia, jadi perpindahan dilakukan manual bersama tim.",
  },
];

function PlanCard({ plan }: { plan: PublicPlan }) {
  const free = plan.monthlyPrice === 0;
  return (
    <article className={`pricing-card ${plan.featured ? "pricing-card--featured" : ""}`}>
      {plan.featured && <span className="pricing-badge">Paling sesuai</span>}
      <h3>{plan.name}</h3>
      <p className="price">{formatRupiah(plan.monthlyPrice)}{!free && <small> / bulan</small>}</p>
      <p>{plan.tagline}</p>
      <Link className={`button ${plan.featured ? "button--primary" : "button--ghost"}`} href={free ? "/masuk" : "/kontak"}>
        {free ? "Mulai gratis" : `Ambil paket ${plan.name}`}
      </Link>
      <ul className="pricing-list">
        {plan.highlights.map(item => <li key={item}><Check size={16} /> {item}</li>)}
      </ul>
    </article>
  );
}

export default async function PricingPage() {
  // Halaman publik tidak boleh gagal hanya karena database belum siap.
  const plans = await listPublicPlans().catch(() => [] as PublicPlan[]);

  return <>
    <PublicHeader />
    <main>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Harga</p>
          <h1>Bayar sesuai volume percakapan yang Anda tangani.</h1>
          <p>Mulai gratis untuk menguji relevansi kata kunci, lalu naik saat lead yang masuk sudah layak ditanggapi setiap hari. Harga dalam Rupiah per bulan.</p>
        </div>
      </section>

      <section className="content-page">
        <div className="container">
          {plans.length === 0
            ? <p className="section-copy">Daftar paket belum dapat dimuat. Silakan muat ulang halaman atau <Link className="text-link" href="/kontak">hubungi tim</Link>.</p>
            : <div className="pricing-grid">{plans.map(plan => <PlanCard key={plan.code} plan={plan} />)}</div>}

          <div className="pricing-note">
            <ShieldCheck size={18} />
            <p><strong>Penagihan otomatis belum tersedia.</strong> Paket berbayar diaktifkan manual oleh tim setelah Anda menghubungi kami, dan kuota langsung berlaku di workspace begitu paket disetel. Mode tinjau dulu tetap menjadi bawaan di semua paket.</p>
          </div>

          <div className="faq-list">
            {FAQ.map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
          </div>
        </div>
      </section>
    </main>
    <PublicFooter />
  </>;
}
