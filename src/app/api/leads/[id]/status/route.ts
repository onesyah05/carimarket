import { LeadStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

const schema = z.object({ saved: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Status lead tidak valid." }, { status: 400 });
    const user = await getWorkspaceUser();
    const { id } = await params;
    const lead = await prisma.lead.findFirst({ where: { id, userId: user.id }, select: { id: true, status: true } });
    if (!lead) throw new ThreadsIntegrationError("LEAD_NOT_FOUND", "Lead tidak ditemukan.", 404);
    if (lead.status === LeadStatus.REPLIED) throw new ThreadsIntegrationError("LEAD_REPLIED", "Lead yang sudah dibalas tidak dapat diubah menjadi tersimpan.", 409);
    const updated = await prisma.lead.update({ where: { id }, data: { status: input.data.saved ? LeadStatus.SAVED : LeadStatus.NEW }, select: { status: true } });
    return NextResponse.json({ success: true, data: { status: updated.status === LeadStatus.SAVED ? "Tersimpan" : "Baru" } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
