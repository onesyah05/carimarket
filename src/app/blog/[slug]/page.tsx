import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { estimateReadMinutes, getPublicArticleBySlug } from "@/server/cms/articles";
import { formatDate } from "@/lib/format";

function ArticleBody({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) return <h2 key={index}>{block.slice(3)}</h2>;
        return <p key={index}>{block}</p>;
      })}
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublicArticleBySlug(slug).catch(() => null);
  if (!article) return {};
  return {
    title: article.metaTitle ?? article.title,
    description: article.metaDescription ?? article.excerpt ?? undefined,
    openGraph: { title: article.metaTitle ?? article.title, description: article.metaDescription ?? article.excerpt ?? undefined, type: "article" },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getPublicArticleBySlug(slug).catch(() => null);
  if (!article) notFound();
  const readMinutes = estimateReadMinutes(article.content);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription ?? article.excerpt ?? undefined,
    datePublished: article.publishedAt?.toISOString(),
    author: { "@type": "Organization", name: "Cari Market" },
  };
  return (
    <>
      <PublicHeader />
      <main>
        <article>
          <header className="page-hero">
            <div className="container">
              <p className="eyebrow">{article.category?.name ?? "Artikel"} · {readMinutes} menit baca</p>
              <h1>{article.title}</h1>
              {article.excerpt && <p>{article.excerpt}</p>}
            </div>
          </header>
          <div className="content-page">
            <div className="content-narrow">
              <p className="article-date">Terbit {formatDate(article.publishedAt)}</p>
              <div className="article-body"><ArticleBody content={article.content} /></div>
            </div>
          </div>
        </article>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicFooter />
    </>
  );
}
