import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { buildOpenApiDocument } from "@/server/api/openapi";

export const runtime = "nodejs";

/**
 * Berkas OpenAPI untuk developer aplikasi mobile.
 *
 * Hanya dilayani untuk sesi Superadmin; dokumentasi API tidak pernah terbuka
 * untuk publik maupun pengguna biasa.
 */
export async function GET() {
  try {
    await requireApiRole(["SUPERADMIN"]);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const document = buildOpenApiDocument(baseUrl);
    return new NextResponse(JSON.stringify(document, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"carimarket-mobile-api.json\"",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
