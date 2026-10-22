import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { closeTicketAsUser, replyAsUser, requireTicketForUser } from "@/server/support/tickets";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

const replySchema = z.object({ body: z.string().trim().min(2, "Pesan tidak boleh kosong.").max(4_000) });

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await getWorkspaceUser();
    const { id } = await params;
    return NextResponse.json({ success: true, data: await requireTicketForUser(user.id, id) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** POST — balasan dari pemilik tiket. */
export async function POST(request: Request, { params }: Params) {
  try {
    enforceSameOrigin(request);
    const user = await getWorkspaceUser();
    enforceRateLimit(`support-reply:${user.id}`, 30, 600_000);

    const { id } = await params;
    const input = replySchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: await replyAsUser(user, { ticketId: id, body: input.data.body }) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** PATCH — pengguna menutup tiketnya sendiri. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    enforceSameOrigin(request);
    const user = await getWorkspaceUser();
    const { id } = await params;
    return NextResponse.json({ success: true, data: await closeTicketAsUser(user, id) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
