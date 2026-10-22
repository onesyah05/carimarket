import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/server/auth/api-guards";
import {
  STATIC_PAGE_SLUGS,
  listStaticPagesForCms,
  resetStaticPage,
  saveStaticPage,
  staticPageSchema,
} from "@/server/cms/static-pages";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

/**
 * CMS halaman statis.
 *
 * Slug-nya daftar tertutup, jadi endpoint ini tidak dapat dipakai menumbuhkan
 * halaman baru yang tidak punya rute. Mengubah teks halaman publik adalah
 * keputusan pemasaran yang terlihat semua orang, jadi hanya Superadmin.
 */
export async function GET() {
  try {
    await requireApiRole(["SUPERADMIN"]);
    return NextResponse.json({ success: true, data: await listStaticPagesForCms() });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireApiRole(["SUPERADMIN"]);
    enforceRateLimit(`cms-halaman:${actor.id}`, 30, 600_000);

    const input = staticPageSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }
    await saveStaticPage(actor.id, input.data);
    return NextResponse.json({ success: true, data: { slug: input.data.slug } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** DELETE — mengembalikan halaman ke salinan bawaan di kode. */
export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireApiRole(["SUPERADMIN"]);
    const slug = z.enum(STATIC_PAGE_SLUGS).safeParse(new URL(request.url).searchParams.get("slug"));
    if (!slug.success) {
      return NextResponse.json({ error: "Halaman tidak dikenali.", code: "INVALID_INPUT" }, { status: 400 });
    }
    await resetStaticPage(actor.id, slug.data);
    return NextResponse.json({ success: true, data: { slug: slug.data } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
