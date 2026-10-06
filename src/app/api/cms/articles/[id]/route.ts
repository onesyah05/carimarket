import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/server/auth/api-guards";
import { deleteArticle, updateArticle } from "@/server/cms/articles";
import { articleFieldsSchema } from "@/server/cms/schemas";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

const patchSchema = z.object({
  fields: articleFieldsSchema.optional(),
  action: z.enum(["SUBMIT_REVIEW", "PUBLISH", "SCHEDULE", "BACK_TO_DRAFT", "ARCHIVE", "RESTORE"]).optional(),
  scheduledFor: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("cms-articles", 60, 60_000);
    const actor = await requireApiRole(["ADMIN", "SUPERADMIN"]);
    const { id } = await params;

    const input = patchSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: "Permintaan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }

    const article = await updateArticle(actor, id, input.data);
    return NextResponse.json({ success: true, data: { id: article.id, status: article.status, slug: article.slug } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("cms-articles", 30, 60_000);
    const actor = await requireApiRole(["ADMIN", "SUPERADMIN"]);
    const { id } = await params;

    await deleteArticle(actor, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
