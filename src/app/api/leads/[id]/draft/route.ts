import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { saveReplyDraft } from "@/server/replies/send-service";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

const schema = z.object({
  draftId: z.string().trim().min(1).max(191).optional(),
  body: z.string().trim().min(1).max(500),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Isi draf harus 1–500 karakter." }, { status: 400 });
    const user = await getWorkspaceUser();
    const { id: leadId } = await params;
    const draft = await saveReplyDraft({ userId: user.id, leadId, body: input.data.body, draftId: input.data.draftId });
    return NextResponse.json({ success: true, data: draft });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
