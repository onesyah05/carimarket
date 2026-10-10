import { KeywordKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { assertKeywordQuota } from "@/server/usage/limits";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

const createSchema = z.object({ phrase: z.string().trim().min(2).max(120), negative: z.boolean().default(false) });
const updateSchema = z.object({ id: z.string().min(1).max(191), active: z.boolean() });
const deleteSchema = z.object({ id: z.string().min(1).max(191) });

function serialize(keyword: { id: string; phrase: string; kind: KeywordKind; isActive: boolean; _count: { leadMatches: number } }) {
  return { id: keyword.id, label: keyword.phrase, negative: keyword.kind === KeywordKind.EXCLUDE, matches: keyword._count.leadMatches, active: keyword.isActive };
}

export async function GET() {
  try {
    const user = await getWorkspaceUser();
    const keywords = await prisma.keyword.findMany({ where: { userId: user.id }, include: { _count: { select: { leadMatches: true } } }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, data: keywords.map(serialize) });
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
    const user = await getWorkspaceUser();
    const kind = input.data.negative ? KeywordKind.EXCLUDE : KeywordKind.INCLUDE;
    const normalized = input.data.phrase.toLocaleLowerCase("id-ID");
    await assertKeywordQuota(user.id, kind, normalized);
    const keyword = await prisma.keyword.upsert({
      where: { userId_normalized_kind: { userId: user.id, normalized, kind } },
      update: { phrase: input.data.phrase, isActive: true },
      create: { userId: user.id, phrase: input.data.phrase, normalized, kind },
      include: { _count: { select: { leadMatches: true } } },
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
    const user = await getWorkspaceUser();
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
    const user = await getWorkspaceUser();
    const result = await prisma.keyword.deleteMany({ where: { id: input.data.id, userId: user.id } });
    if (!result.count) throw new ThreadsIntegrationError("KEYWORD_NOT_FOUND", "Kata kunci tidak ditemukan.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
