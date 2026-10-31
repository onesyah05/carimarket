import Link from "next/link";
import { ArrowRight, CalendarClock, CreditCard, Eye, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { JsonLd } from "@/components/json-ld";
import { ScrollReveal } from "@/components/scroll-reveal";
import { HeroPreview } from "@/features/landing/hero-preview";
import { HowItWorks } from "@/features/landing/how-it-works";
import { FeatureGrid } from "@/features/landing/feature-grid";
import { ModeCards } from "@/features/landing/mode-cards";
import { PlanPreview } from "@/features/landing/plan-preview";
import { InteractiveFaq } from "@/features/landing/interactive-faq";
import { listPublicFaqs } from "@/server/cms/faq";
import { listPublicPlans, type PublicPlan } from "@/server/plans/queries";
import { faqPageSchema } from "@/lib/seo";

/**
 * Beranda.
 *
 * Arah visualnya tenang: kertas lapang, tipografi besar tanpa gradien neon,
 * dan gerak yang nyaris tidak ada. Seksi yang bersifat jualan — tabel "kami
 * vs mereka" dan kalkulator potensi pendapatan — sengaja dihapus; keduanya
 * menuntut kepercayaan sebelum memberi alasan, dan itulah yang membuat halaman
 * terasa bising.
 *
 * Isi paket dan FAQ dibaca dari database, jadi beranda tidak pernah
 * menampilkan harga atau jawaban yang sudah usang. Cache lima menit mengikuti
 * halaman publik lainnya.
 */
export const revalidate = 300;

export default async function HomePage() {
  const [faqs, plans] = await Promise.all([
    listPublicFaqs().catch(() => []),
    listPublicPlans().catch(() => [] as PublicPlan[]),
  ]);

  return (
    <div className="site">
      {/* Satu pengamat untuk seluruh elemen ber-data-reveal di halaman ini. */}
      <ScrollReveal />
      <PublicHeader />

      <main>
        <section className="hero">
          <div className="container hero__inner">
            <div className="hero__copy">
              <p className="site-eyebrow">Radar percakapan Threads</p>

              <h1 className="site-display">
                Temukan pelanggan saat mereka sedang bertanya.
              </h1>

              <p className="site-lead">
                Cari Market memantau percakapan publik di Threads yang cocok dengan kata kunci bisnis Anda, memberinya
                skor relevansi, lalu menyiapkan draft balasan. Tidak ada yang terkirim sebelum Anda menyetujuinya.
              </p>

              <div className="hero__actions">
                <Link className="btn btn--primary btn--lg" href="/daftar">
                  Coba gratis <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link className="btn btn--secondary btn--lg" href="/#cara-kerja">
                  Lihat cara kerjanya
                </Link>
              </div>

              <ul className="hero__assurances">
                <li><Eye size={15} aria-hidden="true" /> Mode tinjau dulu sejak awal</li>
                <li><CreditCard size={15} aria-hidden="true" /> Tanpa kartu kredit</li>
                <li><CalendarClock size={15} aria-hidden="true" /> Paket Starter gratis tanpa batas waktu</li>
              </ul>
            </div>

            <div className="hero__visual">
              <HeroPreview />
            </div>
          </div>
        </section>

        {/* Keterangan yang dapat diperiksa, bukan angka pengguna yang dikarang. */}
        <section className="site-section site-section--tight site-section--attached" aria-label="Ringkasan cara kerja">
          <div className="container">
            <dl className="facts">
              <div className="facts__item" data-reveal>
                <dt>Jadwal pencarian</dt>
                <dd>Tiap 5 jam</dd>
                <p>Interval tercepat pada paket Pro. Pencarian manual kapan saja.</p>
              </div>
              <div className="facts__item" data-reveal>
                <dt>Skor relevansi</dt>
                <dd>0–100</dd>
                <p>Dihitung dari kecocokan kata kunci dan konteks postingan.</p>
              </div>
              <div className="facts__item" data-reveal>
                <dt>Pengaman bawaan</dt>
                <dd>5 lapis</dd>
                <p>Ambang skor, jeda kirim, batas harian, jam tenang, kata terlarang.</p>
              </div>
              <div className="facts__item" data-reveal>
                <dt>Kategori bisnis</dt>
                <dd>10 bidang</dd>
                <p>Dari jasa kreatif dan drone sampai properti, kuliner, dan teknologi.</p>
              </div>
            </dl>
          </div>
        </section>

        <HowItWorks />
        <FeatureGrid />
        <ModeCards />

        <PlanPreview plans={plans} />

        {faqs.length > 0 && <>
          <InteractiveFaq items={faqs} />
          {/* Pertanyaan yang sama dibaca mesin pencari sebagai FAQPage. */}
          <JsonLd data={faqPageSchema(faqs.map(faq => ({ question: faq.question, answer: faq.answer })))} />
        </>}

        <section className="site-section site-section--tight">
          <div className="container">
            <div className="closing" data-reveal>
              <div className="closing__body">
                <h2>Percakapannya sudah berlangsung. Tinggal ikut menjawab.</h2>
                <p>
                  Susun kata kunci pertama Anda dalam beberapa menit, lalu lihat percakapan apa yang sebenarnya cocok
                  dengan layanan Anda sebelum memutuskan apa pun.
                </p>
                <div className="closing__actions">
                  <Link className="btn btn--light btn--lg" href="/daftar">
                    Buat akun gratis <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  <Link className="btn btn--on-deep btn--lg" href="/harga">Lihat paket</Link>
                </div>
                <ul className="closing__fineprint">
                  <li><ShieldCheck size={14} aria-hidden="true" /> Mode tinjau dulu aktif sejak awal</li>
                  <li>Data Anda dapat diunduh dan akun dapat ditutup kapan saja</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
