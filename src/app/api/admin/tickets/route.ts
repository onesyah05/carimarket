import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { listTicketsForInternal, replyAsStaff, requireTicketForInternal, staffReplySchema } from "@/server/support/tickets";

export const runtime = "nodejs";

/**
 * Antrean tiket untuk staf.
 *
 * Admin dan Superadmin sama-sama boleh menjawab: menangani dukungan memang
 * pekerjaan Admin menurut pembagian peran, dan tiket tidak memuat kredensial
 * maupun data billing.
 */
export async function GET(request: Request) {
  try {
    await requireApiRole(["ADMIN", "SUPERADMIN"]);
    const ticketId = new URL(request.url).searchParams.get("id");
    const data = ticketId ? await requireTicketForInternal(ticketId) : await listTicketsForInternal();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** POST — balasan staf, termasuk perubahan status, prioritas, dan penugasan. */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireApiRole(["ADMIN", "SUPERADMIN"]);
    enforceRateLimit(`support-staff-reply:${actor.id}`, 60, 600_000);

    const input = staffReplySchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: await replyAsStaff(actor, input.data) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
