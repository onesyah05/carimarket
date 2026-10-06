import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { createArticle } from "@/server/cms/articles";
import { articleFieldsSchema } from "@/server/cms/schemas";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("cms-articles", 30, 60_000);
    const actor = await requireApiRole(["ADMIN", "SUPERADMIN"]);

    const input = articleFieldsSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Periksa kembali isian artikel.", code: "INVALID_INPUT" }, { status: 400 });
    }

    const article = await createArticle(actor, input.data);
    return NextResponse.json({ success: true, data: { id: article.id, slug: article.slug } }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
