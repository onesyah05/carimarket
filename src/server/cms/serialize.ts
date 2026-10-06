import "server-only";
import type { Article, Category, User } from "@prisma/client";
import type { CmsArticle } from "@/features/cms/components/articles-manager";

type ArticleWithRelations = Article & {
  author: Pick<User, "name">;
  category: Pick<Category, "name"> | null;
  tags: Array<{ tag: { name: string } }>;
};

export function serializeCmsArticle(article: ArticleWithRelations): CmsArticle {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    content: article.content,
    coverImageUrl: article.coverImageUrl,
    categoryName: article.category?.name ?? null,
    tags: article.tags.map(item => item.tag.name),
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    status: article.status,
    author: article.author.name,
    authorId: article.authorId,
    scheduledFor: article.scheduledFor ? article.scheduledFor.toISOString() : null,
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
    updatedAt: article.updatedAt.toISOString(),
  };
}
