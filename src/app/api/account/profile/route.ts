import { NextResponse } from "next/server";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { getAccountOverview, identitySchema, updateAccountIdentity } from "@/server/settings/account";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

/** Data akun pemilik sesi. Berlaku untuk semua role. */
export async function GET() {
  try {
    const user = await getWorkspaceUser();
    return NextResponse.json({ success: true, data: await getAccountOverview(user) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** Menyimpan nama dan email akun. */
export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getWorkspaceUser();
    enforceRateLimit(`account-profile:${user.id}`, 10, 600_000);
    const input = identitySchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Data akun tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: await updateAccountIdentity(user, input.data) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
