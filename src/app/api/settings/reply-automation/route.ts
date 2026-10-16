import { NextResponse } from "next/server";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { getReplyAutomation, replyAutomationSchema, updateReplyAutomation } from "@/server/settings/workspace-settings";
import { requireEntitledUser } from "@/server/auth/access-gate";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireEntitledUser();
    return NextResponse.json({ success: true, data: await getReplyAutomation(user.id) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = replyAutomationSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Pengaturan balasan tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    const user = await requireEntitledUser();
    return NextResponse.json({ success: true, data: await updateReplyAutomation(user.id, input.data) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
