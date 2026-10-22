import { NextResponse } from "next/server";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { createTicket, listMyTickets, newTicketSchema } from "@/server/support/tickets";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

/**
 * Tiket dukungan milik pengguna.
 *
 * Penjaganya `getWorkspaceUser`, bukan gerbang langganan: orang yang paketnya
 * habis atau pembayarannya tersangkut justru paling perlu menghubungi
 * dukungan. Akun yang ditangguhkan tetap ditolak di sana.
 */
export async function GET() {
  try {
    const user = await getWorkspaceUser();
    return NextResponse.json({ success: true, data: await listMyTickets(user.id) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getWorkspaceUser();
    enforceRateLimit(`support-ticket-create:${user.id}`, 5, 3_600_000);

    const input = newTicketSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: await createTicket(user, input.data) }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
