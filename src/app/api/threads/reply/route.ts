import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { sendReplyFromDraft } from "@/server/replies/send-service";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

const inputSchema = z.object({
  leadId: z.string().trim().min(1).max(191),
  postId: z.string().trim().min(1).max(191),
  body: z.string().trim().min(1).max(500),
  draftId: z.string().trim().min(1).max(191).optional(),
  confirmed: z.literal(true),
  idempotencyKey: z.string().trim().min(8).max(191),
});

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Data balasan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });

    const user = await getWorkspaceUser();
    enforceRateLimit(`threads-reply:${user.id}`, 20, 60_000);

    const result = await sendReplyFromDraft({
      userId: user.id,
      leadId: input.data.leadId,
      postId: input.data.postId,
      body: input.data.body,
      draftId: input.data.draftId,
      idempotencyKey: input.data.idempotencyKey,
    });
    return NextResponse.json({ success: true, data: { status: result.status, externalReplyId: result.externalReplyId ?? undefined } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
