import { ReplyMode, ReplyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
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
    const lead = await prisma.lead.findFirst({ where: { id: leadId, userId: user.id }, select: { id: true } });
    if (!lead) throw new ThreadsIntegrationError("LEAD_NOT_FOUND", "Lead tidak ditemukan.", 404);

    const existing = input.data.draftId
      ? await prisma.replyDraft.findFirst({ where: { id: input.data.draftId, leadId, userId: user.id } })
      : null;
    if (input.data.draftId && !existing) throw new ThreadsIntegrationError("DRAFT_NOT_FOUND", "Draf tidak ditemukan.", 404);
    if (existing && !(new Set<ReplyStatus>([ReplyStatus.DRAFT, ReplyStatus.PENDING_APPROVAL, ReplyStatus.FLAGGED, ReplyStatus.FAILED])).has(existing.status)) {
      throw new ThreadsIntegrationError("DRAFT_LOCKED", "Draf ini sudah diproses dan tidak dapat diubah.", 409);
    }
    const draft = existing
      ? await prisma.replyDraft.update({ where: { id: existing.id }, data: { body: input.data.body, status: ReplyStatus.DRAFT, version: { increment: 1 } } })
      : await prisma.replyDraft.create({ data: { userId: user.id, leadId, body: input.data.body, status: ReplyStatus.DRAFT, deliveryMode: ReplyMode.REVIEW_FIRST } });
    return NextResponse.json({ success: true, data: { id: draft.id, body: draft.body, status: draft.status } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
