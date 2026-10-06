import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const staticRoutes = ["", "/harga", "/blog", "/tentang", "/kontak", "/kebijakan-privasi", "/syarat-ketentuan", "/penghapusan-data"];
  let articles: MetadataRoute.Sitemap = [];
  try {
    const published = await prisma.article.findMany({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
      select: { slug: true, updatedAt: true },
      take: 500,
    });
    articles = published.map(article => ({
      url: `${base}/blog/${article.slug}`,
      lastModified: article.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    }));
  } catch {
    articles = [];
  }
  return [
    ...staticRoutes.map(route => ({ url: `${base}${route}`, lastModified: new Date(), changeFrequency: route === "" ? "weekly" as const : "monthly" as const, priority: route === "" ? 1 : 0.7 })),
    ...articles,
  ];
}
