import type { Metadata } from "next";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { formatRupiah } from "@/lib/format";
import { listPublicPlans, type PublicPlan } from "@/server/plans/queries";
import { JsonLd } from "@/components/json-ld";
import { faqPageSchema, pricingSchema } from "@/lib/seo";
import { listPublicFaqs } from "@/server/cms/faq";
import { readStaticPage } from "@/server/cms/static-pages";
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

/**
 * Cadangan bila CMS belum terisi. Pertanyaan khas halaman harga disimpan di
 * sini, bukan di modul FAQ beranda, karena jawabannya memuat angka paket yang
 * memang berubah bersama katalog.
 */
const FALLBACK_FAQ = [
  {
    question: "Bagaimana cara membayar?",
    answer: "Tagihan dibuat dari dashboard dan memuat nominal dengan kode unik tiga digit, mis. Rp 98.417. Transfer tepat sampai tiga angka terakhir agar pembayaran Anda dikenali pada mutasi, lalu tekan tombol konfirmasi. Tagihan yang belum dibayar dalam 24 jam otomatis kedaluwarsa dan dapat dibuat ulang.",
  },
  {
    question: "Bagaimana kuota dihitung?",
    answer: "Satu pencarian dihitung setiap kali sebuah kata kunci dijalankan, baik manual maupun terjadwal. Satu balasan dihitung saat balasan benar-benar terkirim ke Threads; balasan yang gagal terkirim tidak memakan kuota. Kuota berjalan per bulan kalender dan direset setiap awal bulan.",
  },
  {
    question: "Seberapa sering kata kunci dicari ulang?",
    answer: "Jaraknya ditentukan paket: Starter sekali sehari, Bisnis tiap 6 jam, dan Pro tiap 3 jam. Jadwal ini dipilih agar kuota bulanan benar-benar cukup untuk seluruh kata kunci pada paket tersebut. Pencarian manual dari halaman Lead tetap dapat dijalankan kapan saja dan ikut memakai kuota.",
  },
  {
    question: "Apa yang terjadi jika kuota habis?",
    answer: "Pencarian dan pengiriman balasan baru ditolak sampai periode berikutnya, sedangkan data lead dan draft yang sudah ada tetap dapat dibuka. Peringatan muncul saat pemakaian mencapai 80 persen.",
  },
  {
    question: "Apakah batas ini terkait batas Meta?",
    answer: "Ya. Meta membatasi 2.200 permintaan pencarian kata kunci per 24 jam dan sekitar 1.000 balasan per 24 jam untuk setiap akun Threads yang terhubung. Kuota paket dipilih agar tetap di bawah batas tersebut, dan platform juga punya batas harian sendiri di bawah batas Meta. Bila batas platform tercapai, permintaan ditolak tanpa mengurangi kuota paket Anda.",
  },
  {
    question: "Bisakah berpindah paket?",
    answer: "Bisa, langsung dari menu Langganan di dashboard. Pilih paket dan durasi, lalu bayar ke metode yang tersedia. Pembayaran untuk paket yang sama menambah masa aktif sehingga sisa periode tidak hangus, sedangkan pindah paket membuat kuota paket baru berlaku sejak pembayaran disetujui.",
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
      <Link className={`button ${plan.featured ? "button--primary" : "button--ghost"}`} href="/daftar">
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
  const [plans, cmsFaqs, note] = await Promise.all([
    listPublicPlans().catch(() => [] as PublicPlan[]),
    listPublicFaqs().catch(() => []),
    readStaticPage("harga-catatan").catch(() => null),
  ]);

  // FAQ khusus harga diambil dari CMS bila ada entri berkategori HARGA;
  // kalau belum, daftar bawaan di berkas ini yang tampil.
  const pricingFaqs = cmsFaqs.filter(faq => faq.category === "HARGA");
  const faqs = pricingFaqs.length > 0
    ? pricingFaqs.map(faq => ({ question: faq.question, answer: faq.answer }))
    : FALLBACK_FAQ;

  return <div className="site">
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

          {note && <div className="pricing-note">
            <ShieldCheck size={18} />
            <p><strong>{note.title}.</strong> {note.body}</p>
          </div>}

          <div className="faq-list">
            {faqs.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
          </div>
        </div>
      </section>
    </main>
    <PublicFooter />

    {/* Paket dibaca mesin pencari sebagai satu produk dengan beberapa Offer. */}
    {plans.length > 0 && <JsonLd data={pricingSchema(plans)} />}
    <JsonLd data={faqPageSchema(faqs)} />
  </div>;
}
