import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { isTableResource, runTable } from "@/server/admin/tables/registry";
import { enforceRateLimit } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

/**
 * Satu endpoint untuk seluruh tabel konsol internal.
 *
 * Peran yang boleh membaca tiap tabel ditentukan di registry, bukan di sini,
 * sehingga menambah tabel baru tidak bisa lupa menyebut siapa yang berhak.
 * Route ini hanya memastikan pemanggilnya staf aktif, lalu menyerahkan
 * pemeriksaan per-tabel ke `runTable`.
 *
 * Hanya membaca, jadi tidak ada pemeriksaan origin — tidak ada efek samping
 * yang dapat dipicu dari situs lain, dan jawabannya tetap butuh cookie sesi.
 */
export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    if (!isTableResource(resource)) {
      return NextResponse.json({ error: "Tabel tidak dikenali.", code: "NOT_FOUND" }, { status: 404 });
    }

    const actor = await requireApiRole(["SUPERADMIN", "ADMIN"]);
    enforceRateLimit(`admin-table:${actor.id}`, 240, 60_000);

    const url = new URL(request.url);
    const page = await runTable(resource, actor.role, {
      q: url.searchParams.get("q") ?? "",
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 20),
    });

    return NextResponse.json({ success: true, data: page }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
