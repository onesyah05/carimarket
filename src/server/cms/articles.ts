import "server-only";
import { ArticleStatus, Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export type ArticleAction = "SUBMIT_REVIEW" | "PUBLISH" | "SCHEDULE" | "BACK_TO_DRAFT" | "ARCHIVE" | "RESTORE";

export type ArticleFields = {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
  categoryName?: string;
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
};

export type ArticleActionFields = {
  fields?: ArticleFields;
  action?: ArticleAction;
  scheduledFor?: string;
};

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110);
}

async function uniqueSlug(base: string, ignoreId?: string) {
  const root = slugify(base) || "artikel";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const existing = await prisma.article.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
  }
  return `${root}-${Date.now()}`;
}

async function upsertCategory(name?: string) {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return prisma.category.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed, slug: slugify(trimmed) || `kategori-${Date.now()}` },
  });
}

async function attachTags(articleId: string, tags: string[]) {
  const names = [...new Set(tags.map(tag => tag.trim()).filter(Boolean))].slice(0, 10);
  await prisma.articleTag.deleteMany({ where: { articleId } });
  for (const name of names) {
    const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name, slug: slugify(name) || `tag-${Date.now()}` } });
    await prisma.articleTag.create({ data: { articleId, tagId: tag.id } });
  }
}

function canEditFields(role: User["role"], status: ArticleStatus) {
  if (role === "SUPERADMIN") return true;
  return status === "DRAFT" || status === "IN_REVIEW";
}

const TRANSITIONS: Partial<Record<User["role"], Partial<Record<ArticleStatus, ArticleStatus[]>>>> = {
  USER: {},
  ADMIN: { DRAFT: ["IN_REVIEW"] },
  SUPERADMIN: {
    DRAFT: ["PUBLISHED", "SCHEDULED"],
    IN_REVIEW: ["PUBLISHED", "SCHEDULED", "DRAFT"],
    SCHEDULED: ["PUBLISHED", "DRAFT"],
    PUBLISHED: ["ARCHIVED"],
    ARCHIVED: ["DRAFT"],
  },
};

export async function createArticle(actor: User, input: ArticleFields) {
  const slug = await uniqueSlug(input.slug?.trim() || input.title);
  const category = await upsertCategory(input.categoryName);
  const article = await prisma.article.create({
    data: {
      authorId: actor.id,
      title: input.title.trim(),
      slug,
      excerpt: input.excerpt?.trim() || null,
      content: input.content,
      coverImageUrl: input.coverImageUrl?.trim() || null,
      metaTitle: input.metaTitle?.trim() || null,
      metaDescription: input.metaDescription?.trim() || null,
      categoryId: category?.id ?? null,
      status: ArticleStatus.DRAFT,
    },
  });
  if (input.tags?.length) await attachTags(article.id, input.tags);
  await recordAudit({ actorId: actor.id, action: "ARTICLE_CREATED", entityType: "Article", entityId: article.id, metadata: { title: article.title } });
  return article;
}

export async function updateArticle(actor: User, id: string, input: ArticleActionFields) {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) throw new ThreadsIntegrationError("ARTICLE_NOT_FOUND", "Artikel tidak ditemukan.", 404);

  let nextStatus = article.status;
  let publishedAt = article.publishedAt;
  let scheduledFor = article.scheduledFor;

  if (input.action) {
    const allowed = TRANSITIONS[actor.role]?.[article.status] ?? [];
    if (input.action === "SUBMIT_REVIEW") {
      if (article.status !== ArticleStatus.DRAFT) throw new ThreadsIntegrationError("INVALID_TRANSITION", "Hanya draft yang dapat diajukan untuk review.", 400);
      nextStatus = ArticleStatus.IN_REVIEW;
    } else if (input.action === "PUBLISH") {
      if (!allowed.includes(ArticleStatus.PUBLISHED)) throw new ThreadsIntegrationError("INVALID_TRANSITION", "Perubahan status ini tidak diizinkan.", 403);
      nextStatus = ArticleStatus.PUBLISHED;
      publishedAt = new Date();
      scheduledFor = null;
    } else if (input.action === "SCHEDULE") {
      if (!allowed.includes(ArticleStatus.SCHEDULED)) throw new ThreadsIntegrationError("INVALID_TRANSITION", "Perubahan status ini tidak diizinkan.", 403);
      const when = input.scheduledFor ? new Date(input.scheduledFor) : null;
      if (!when || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        throw new ThreadsIntegrationError("INVALID_SCHEDULE", "Tentukan waktu terbit di masa depan.", 400);
      }
      nextStatus = ArticleStatus.SCHEDULED;
      scheduledFor = when;
    } else if (input.action === "BACK_TO_DRAFT") {
      if (!allowed.includes(ArticleStatus.DRAFT)) throw new ThreadsIntegrationError("INVALID_TRANSITION", "Perubahan status ini tidak diizinkan.", 403);
      nextStatus = ArticleStatus.DRAFT;
      scheduledFor = null;
    } else if (input.action === "ARCHIVE") {
      if (!allowed.includes(ArticleStatus.ARCHIVED)) throw new ThreadsIntegrationError("INVALID_TRANSITION", "Perubahan status ini tidak diizinkan.", 403);
      nextStatus = ArticleStatus.ARCHIVED;
    } else if (input.action === "RESTORE") {
      if (!allowed.includes(ArticleStatus.DRAFT)) throw new ThreadsIntegrationError("INVALID_TRANSITION", "Perubahan status ini tidak diizinkan.", 403);
      nextStatus = ArticleStatus.DRAFT;
      publishedAt = null;
    }
  }

  const editingFields = Boolean(input.fields);
  if (editingFields && !canEditFields(actor.role, article.status)) {
    throw new ThreadsIntegrationError("FORBIDDEN", "Artikel yang sudah terbit atau dijadwalkan hanya dapat diubah Superadmin.", 403);
  }

  const fields = input.fields;
  let categoryId: string | null | undefined;
  if (fields && "categoryName" in fields) categoryId = (await upsertCategory(fields.categoryName))?.id ?? null;

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: {
      ...(fields ? {
        title: fields.title.trim(),
        slug: fields.slug && slugify(fields.slug) !== article.slug ? await uniqueSlug(fields.slug, article.id) : article.slug,
        excerpt: fields.excerpt?.trim() || null,
        content: fields.content,
        coverImageUrl: fields.coverImageUrl?.trim() || null,
        metaTitle: fields.metaTitle?.trim() || null,
        metaDescription: fields.metaDescription?.trim() || null,
        categoryId,
      } : {}),
      status: nextStatus,
      publishedAt,
      scheduledFor,
    },
  });
  if (fields?.tags) await attachTags(article.id, fields.tags);

  const auditAction = input.action ? `ARTICLE_${input.action}` : "ARTICLE_UPDATED";
  await recordAudit({ actorId: actor.id, action: auditAction, entityType: "Article", entityId: article.id, metadata: { title: updated.title, status: nextStatus } });
  return updated;
}

export async function deleteArticle(actor: User, id: string) {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) throw new ThreadsIntegrationError("ARTICLE_NOT_FOUND", "Artikel tidak ditemukan.", 404);
  if (actor.role !== "SUPERADMIN" && !(article.authorId === actor.id && article.status === ArticleStatus.DRAFT)) {
    throw new ThreadsIntegrationError("FORBIDDEN", "Hanya draft milik sendiri yang dapat dihapus Admin. Artikel lain memerlukan Superadmin.", 403);
  }
  await prisma.article.delete({ where: { id } });
  await recordAudit({ actorId: actor.id, action: "ARTICLE_DELETED", entityType: "Article", entityId: id, metadata: { title: article.title } });
}

export async function listArticlesForCms() {
  return prisma.article.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      author: { select: { name: true } },
      category: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });
}

const publicArticleSelect = Prisma.validator<Prisma.ArticleDefaultArgs>()({
  select: {
    id: true, title: true, slug: true, excerpt: true, content: true, coverImageUrl: true, publishedAt: true,
    metaTitle: true, metaDescription: true,
    category: { select: { name: true } },
    tags: { include: { tag: { select: { name: true } } } },
  },
});

export async function listPublicArticles() {
  return prisma.article.findMany({
    where: { status: ArticleStatus.PUBLISHED, publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    take: 50,
    ...publicArticleSelect,
  });
}

export async function getPublicArticleBySlug(slug: string) {
  return prisma.article.findFirst({
    where: { slug, status: ArticleStatus.PUBLISHED, publishedAt: { lte: new Date() } },
    ...publicArticleSelect,
  });
}

export function estimateReadMinutes(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
