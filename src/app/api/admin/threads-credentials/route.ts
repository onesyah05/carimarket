import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/server/audit";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { createUnofficialThreadsAdapter } from "@/server/integrations/threads/unofficial-adapter";
import {
  clearUnofficialCredentials,
  getUnofficialCredentialsStatus,
  saveUnofficialCredentials,
} from "@/server/integrations/threads/unofficial-credentials";
import { parseUnofficialCredentials } from "@/server/integrations/threads/unofficial-config";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

const PROBE_QUERY = "jasa website";

const saveSchema = z.object({
  cookie: z.string().trim().min(20, "Cookie tidak lengkap."),
  lsd: z.string().trim().min(8, "Token lsd tidak valid."),
  csrf: z.string().trim().min(8, "Token csrftoken tidak valid."),
  note: z.string().trim().max(255).optional(),
});

/**
 * GET — status kredensial (tanpa nilai rahasia).
 * POST — simpan kredensial baru, lalu uji dengan satu pencarian.
 * DELETE — hapus kredensial.
 *
 * SUPERADMIN saja. Cookie sesi adalah kredensial sensitif; menulisnya hanya
 * boleh dilakukan operator tertinggi.
 */
export async function GET() {
  try {
    await requireApiRole(["SUPERADMIN"]);
    const status = await getUnofficialCredentialsStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-threads-credentials", 10, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);

    const input = saveSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    // Validasi dulu sebelum menyimpan: cookie harus benar-benar berfungsi.
    const probe = parseUnofficialCredentials(input.data.cookie, input.data.lsd, input.data.csrf);
    if (!probe) {
      throw new ThreadsIntegrationError(
        "THREADS_CREDENTIALS_INVALID",
        "Cookie harus memuat sessionid, csrftoken, dan ds_user_id.",
        400,
      );
    }

    let probeCount = 0;
    try {
      const adapter = createUnofficialThreadsAdapter(probe);
      const results = await adapter.searchPosts(PROBE_QUERY);
      probeCount = results.length;
    } catch (error) {
      const message = error instanceof ThreadsIntegrationError ? error.message : "Pencarian uji gagal.";
      await recordAudit({
        actorId: actor.id,
        action: "THREADS_CREDENTIALS_PROBE_FAILED",
        entityType: "PlatformSecret",
        metadata: { query: PROBE_QUERY },
      });
      return NextResponse.json({ error: message, code: "THREADS_CREDENTIALS_PROBE_FAILED" }, { status: 400 });
    }

    await saveUnofficialCredentials({
      cookie: input.data.cookie,
      lsd: input.data.lsd,
      csrf: input.data.csrf,
      note: input.data.note,
    });

    await recordAudit({
      actorId: actor.id,
      action: "THREADS_CREDENTIALS_SAVED",
      entityType: "PlatformSecret",
      metadata: { probeQuery: PROBE_QUERY, probeCount },
    });

    return NextResponse.json({
      success: true,
      data: { ...(await getUnofficialCredentialsStatus()), probeCount },
    });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireApiRole(["SUPERADMIN"]);
    await clearUnofficialCredentials();
    await recordAudit({
      actorId: actor.id,
      action: "THREADS_CREDENTIALS_REMOVED",
      entityType: "PlatformSecret",
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
