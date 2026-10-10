import { NextResponse } from "next/server";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { changeAccountPassword, passwordSchema } from "@/server/settings/account";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

/** Mengganti kata sandi akun. Berlaku untuk semua role, termasuk Admin dan Superadmin. */
export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getWorkspaceUser();
    enforceRateLimit(`account-password:${user.id}`, 5, 300_000);
    const input = passwordSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Kata sandi tidak valid." }, { status: 400 });
    }
    const result = await changeAccountPassword(user, input.data, request.headers.get("user-agent") ?? undefined);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
