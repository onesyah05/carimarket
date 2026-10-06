import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { estimateReadMinutes, listPublicArticles } from "@/server/cms/articles";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Blog", description: "Panduan social listening, pencarian lead, dan promosi yang manusiawi di Threads." };

export default async function BlogPage() {
  const articles = await listPublicArticles();
  return <><PublicHeader /><main><section className="page-hero"><div className="container"><p className="eyebrow">Wawasan & panduan</p><h1>Panduan untuk membaca sinyal permintaan.</h1><p>Pelajari cara menemukan lead yang relevan dan membangun percakapan yang tetap manusiawi.</p></div></section><section className="content-page"><div className="container article-grid">{articles.map(article => (
    <article className="article-card" key={article.slug}>
      <div className="article-card__visual"><span>{article.category?.name ?? "Artikel"}</span></div>
      <div className="article-card__body">
        <h2><Link href={`/blog/${article.slug}`}>{article.title}</Link></h2>
        <p>{article.excerpt}</p>
        <div className="article-meta"><span>{formatDate(article.publishedAt)} · {estimateReadMinutes(article.content)} menit baca</span><Link className="text-link" href={`/blog/${article.slug}`}>Baca artikel</Link></div>
      </div>
    </article>
  ))}{articles.length === 0 && <div className="blog-empty"><h2>Artikel sedang disiapkan.</h2><p>Tim kami sedang menulis panduan pertama. Kunjungi lagi sebentar lagi, atau mulai dari halaman <Link href="/harga">paket</Link>.</p></div>}</div></section></main><PublicFooter /></>;
}
