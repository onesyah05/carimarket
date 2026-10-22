import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/server/auth/session";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { closeAccountSchema, closeOwnAccount } from "@/server/settings/account-closure";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

/**
 * POST — menutup akun sendiri.
 *
 * Sesi dibuang setelahnya supaya pengguna tidak tertinggal di dashboard yang
 * datanya baru saja hilang. Penjaga sesi juga sudah menolak akun ber-`deletedAt`,
 * jadi cookie yang masih ada di perangkat lain ikut berhenti berlaku.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getWorkspaceUser();
    enforceRateLimit(`account-close:${user.id}`, 5, 900_000);

    const input = closeAccountSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const result = await closeOwnAccount(user, input.data);
    await destroyCurrentSession();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
