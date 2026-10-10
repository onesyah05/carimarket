import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { revokeCredential } from "@/server/api/credentials";

export const runtime = "nodejs";

/** Mencabut kredensial. Permintaan berikutnya dengan kunci itu ditolak 401. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    const actor = await requireApiRole(["SUPERADMIN"]);
    const { id } = await params;
    const revoked = await revokeCredential(actor, id);
    if (!revoked) throw new ThreadsIntegrationError("CREDENTIAL_NOT_FOUND", "Kredensial tidak ditemukan atau sudah dicabut.", 404);
    return NextResponse.json({ success: true, data: { id, revoked: true } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
