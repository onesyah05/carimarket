import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/server/auth/api-guards";
import { createFaq, deleteFaq, faqSchema, listFaqsForCms, seedDefaultFaqs, updateFaq } from "@/server/cms/faq";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

/**
 * CMS pertanyaan umum.
 *
 * Hanya Superadmin: isi FAQ ikut menjadi structured data FAQPage, jadi
 * mengubahnya berarti mengubah apa yang dibaca mesin pencari tentang produk —
 * sejalan dengan aturan bahwa Admin tidak dapat menerbitkan konten publik
 * tanpa persetujuan.
 */
export async function GET() {
  try {
    await requireApiRole(["SUPERADMIN"]);
    return NextResponse.json({ success: true, data: await listFaqsForCms() });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireApiRole(["SUPERADMIN"]);
    enforceRateLimit(`cms-faq:${actor.id}`, 60, 600_000);

    const payload = await request.json().catch(() => null);
    // Satu endpoint menangani pengisian awal supaya CMS tidak pernah tampil
    // kosong padahal beranda sedang memakai salinan bawaan.
    if (payload && typeof payload === "object" && (payload as { action?: string }).action === "seed") {
      return NextResponse.json({ success: true, data: { created: await seedDefaultFaqs(actor.id) } }, { status: 201 });
    }

    const input = faqSchema.safeParse(payload);
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, data: { id: await createFaq(actor.id, input.data) } }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

const updateInput = faqSchema.extend({ id: z.string().min(1) });

export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireApiRole(["SUPERADMIN"]);
    enforceRateLimit(`cms-faq:${actor.id}`, 60, 600_000);

    const input = updateInput.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }
    const { id, ...rest } = input.data;
    await updateFaq(actor.id, id, rest);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireApiRole(["SUPERADMIN"]);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Pertanyaan tidak disebutkan.", code: "INVALID_INPUT" }, { status: 400 });
    await deleteFaq(actor.id, id);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
