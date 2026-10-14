import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { directSearchSchema } from "@/server/leads/direct-search";
import { runDirectSearch } from "@/server/leads/direct-search-service";
import { publicThreadsError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

/**
 * POST — pencarian Threads ad hoc untuk Superadmin.
 *
 * Tidak memakai kuota paket dan tidak menyimpan apa pun, jadi tidak ada batas
 * kata kunci. Batas yang tetap berlaku hanyalah laju permintaan, supaya sesi
 * Threads platform tidak terbakar oleh pengulangan beruntun.
 */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireApiRole(["SUPERADMIN"]);
    enforceRateLimit(`admin-lead-search:${actor.id}`, 60, 60_000);

    const input = directSearchSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const { capability, hits } = await runDirectSearch(actor.id, input.data.query);
    return NextResponse.json({ success: true, data: hits, meta: { capability, query: input.data.query } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
