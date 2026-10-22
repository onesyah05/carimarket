import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { parseStaticBody, readStaticPage } from "@/server/cms/static-pages";

/**
 * Teks halaman ini dibaca dari CMS supaya dapat dikoreksi tanpa deploy, dengan
 * salinan bawaan di kode bila barisnya belum ada. Cache lima menit mengikuti
 * halaman publik lainnya.
 */
export const revalidate = 300;

export const metadata: Metadata = { title: "Tentang Kami" };

export default async function AboutPage() {
  const page = await readStaticPage("tentang").catch(() => null);
  const content = page ?? { title: "Tentang Cari Market", intro: null, body: "" };
  const blocks = parseStaticBody(content.body);

  return <div className="site">
    <PublicHeader />
    <main>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Tentang Cari Market</p>
          <h1>{content.title}</h1>
          {content.intro && <p>{content.intro}</p>}
        </div>
      </section>
      <section className="content-page">
        <div className="content-narrow">
          {blocks.map((block, index) => block.kind === "heading"
            ? <h2 key={`${block.text}-${index}`}>{block.text}</h2>
            : <p key={`${block.text.slice(0, 24)}-${index}`}>{block.text}</p>)}
        </div>
      </section>
    </main>
    <PublicFooter />
  </div>;
}
