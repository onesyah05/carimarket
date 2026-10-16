import { KeywordKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkKeywordCategory, categorySuggestions } from "@/lib/keyword-categories";
import { isKeywordLocked, keywordUnlockAt, lockRemainingLabel } from "@/lib/keyword-lock";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { assertKeywordQuota, getQuotaSnapshot } from "@/server/usage/limits";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { requireEntitledUser } from "@/server/auth/access-gate";

export const runtime = "nodejs";

const createSchema = z.object({ phrase: z.string().trim().min(2).max(120), negative: z.boolean().default(false) });
const updateSchema = z.object({ id: z.string().min(1).max(191), active: z.boolean() });
const deleteSchema = z.object({ id: z.string().min(1).max(191) });

type KeywordRow = {
  id: string;
  phrase: string;
  kind: KeywordKind;
  isActive: boolean;
  createdAt: Date;
  _count: { leadMatches: number };
};

function serialize(keyword: KeywordRow) {
  return {
    id: keyword.id,
    label: keyword.phrase,
    negative: keyword.kind === KeywordKind.EXCLUDE,
    matches: keyword._count.leadMatches,
    active: keyword.isActive,
    createdAt: keyword.createdAt.toISOString(),
    /** Kata kunci baru terkunci 24 jam agar tidak ditukar bolak-balik. */
    locked: isKeywordLocked(keyword.createdAt),
    unlockAt: keywordUnlockAt(keyword.createdAt).toISOString(),
  };
}

const rowSelect = {
  id: true,
  phrase: true,
  kind: true,
  isActive: true,
  createdAt: true,
  _count: { select: { leadMatches: true } },
} as const;

async function businessCategory(userId: string) {
  const profile = await prisma.businessProfile.findUnique({ where: { userId }, select: { category: true } });
  return profile?.category ?? "";
}

export async function GET() {
  try {
    const user = await requireEntitledUser();
    const [keywords, quota, category] = await Promise.all([
      prisma.keyword.findMany({ where: { userId: user.id }, select: rowSelect, orderBy: { createdAt: "desc" } }),
      getQuotaSnapshot(user.id),
      businessCategory(user.id),
    ]);
    // Batas dihitung dari seluruh kata kunci, termasuk yang dijeda dan negatif.
    return NextResponse.json({
      success: true,
      data: keywords.map(serialize),
      meta: {
        keywordLimit: quota.keywords.limit,
        planName: quota.plan?.name ?? null,
        searchIntervalHours: quota.plan?.searchIntervalHours ?? null,
        category,
        suggestions: categorySuggestions(category),
      },
    });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = createSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Kata kunci harus terdiri dari 2 sampai 120 karakter.", code: "INVALID_INPUT" }, { status: 400 });
    const user = await requireEntitledUser();
    const kind = input.data.negative ? KeywordKind.EXCLUDE : KeywordKind.INCLUDE;

    // Hanya istilah pencarian yang dinilai: kata eksklusi justru sengaja
    // berada di luar bidang usaha ("gratis", "lowongan").
    if (kind === KeywordKind.INCLUDE) {
      const verdict = checkKeywordCategory(input.data.phrase, await businessCategory(user.id));
      if (!verdict.ok) {
        throw new ThreadsIntegrationError("KEYWORD_CATEGORY_MISMATCH", verdict.message, 400);
      }
    }

    const normalized = input.data.phrase.toLocaleLowerCase("id-ID");
    await assertKeywordQuota(user.id, kind, normalized);
    const keyword = await prisma.keyword.upsert({
      where: { userId_normalized_kind: { userId: user.id, normalized, kind } },
      update: { phrase: input.data.phrase, isActive: true },
      create: { userId: user.id, phrase: input.data.phrase, normalized, kind },
      select: rowSelect,
    });
    return NextResponse.json({ success: true, data: serialize(keyword) }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = updateSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Perubahan kata kunci tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    const user = await requireEntitledUser();
    const result = await prisma.keyword.updateMany({ where: { id: input.data.id, userId: user.id }, data: { isActive: input.data.active } });
    if (!result.count) throw new ThreadsIntegrationError("KEYWORD_NOT_FOUND", "Kata kunci tidak ditemukan.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Kata kunci tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    const user = await requireEntitledUser();

    const keyword = await prisma.keyword.findFirst({
      where: { id: input.data.id, userId: user.id },
      select: { id: true, phrase: true, createdAt: true },
    });
    if (!keyword) throw new ThreadsIntegrationError("KEYWORD_NOT_FOUND", "Kata kunci tidak ditemukan.", 404);

    if (isKeywordLocked(keyword.createdAt)) {
      throw new ThreadsIntegrationError(
        "KEYWORD_LOCKED",
        `“${keyword.phrase}” baru ditambahkan dan belum dapat dihapus. Kata kunci terkunci 24 jam agar pencarian sempat berjalan; coba lagi ${lockRemainingLabel(keyword.createdAt)}.`,
        409,
      );
    }

    await prisma.keyword.delete({ where: { id: keyword.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
