import { KeywordKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { listWorkspaceLeads } from "@/server/leads/queries";
import { runKeywordSearch } from "@/server/leads/search-service";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { assertKeywordQuota } from "@/server/usage/limits";
import { isThreadsAvailable } from "@/server/integrations/threads/config";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

const inputSchema = z.object({ query: z.string().trim().min(2).max(100) });

export async function GET() {
  try {
    if (!(await isThreadsAvailable())) throw new ThreadsIntegrationError("THREADS_NOT_CONFIGURED", "Koneksi Threads belum tersedia. Silakan hubungi administrator.", 409);
    const user = await getWorkspaceUser();
    return NextResponse.json({ success: true, data: await listWorkspaceLeads(user.id) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    if (!(await isThreadsAvailable())) throw new ThreadsIntegrationError("THREADS_NOT_CONFIGURED", "Koneksi Threads belum tersedia. Silakan hubungi administrator.", 409);
    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Kata kunci harus terdiri dari 2 sampai 100 karakter.", code: "INVALID_INPUT" }, { status: 400 });

    const user = await getWorkspaceUser();
    enforceRateLimit(`threads-search:${user.id}`, 30, 60_000);
    const normalized = input.data.query.toLocaleLowerCase("id-ID");
    await assertKeywordQuota(user.id, KeywordKind.INCLUDE, normalized);
    const keyword = await prisma.keyword.upsert({
      where: { userId_normalized_kind: { userId: user.id, normalized, kind: KeywordKind.INCLUDE } },
      update: { phrase: input.data.query, isActive: true, lastRunAt: new Date() },
      create: { userId: user.id, phrase: input.data.query, normalized, kind: KeywordKind.INCLUDE, lastRunAt: new Date() },
    });

    const { resultCount, excludedCount } = await runKeywordSearch(keyword.id);
    return NextResponse.json({ success: true, data: await listWorkspaceLeads(user.id), meta: { resultCount, excludedCount } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
