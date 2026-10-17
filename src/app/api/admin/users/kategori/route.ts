import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

const inputSchema = z.object({
  userId: z.string().min(1),
  category: z.string().trim().min(2, "Kategori tidak valid.").max(100),
});

/**
 * PATCH — memindahkan kategori bisnis seorang pelanggan.
 *
 * Pelanggan tidak dapat mengubah kategorinya sendiri karena kategori
 * menentukan kata kunci yang boleh dipakai. Permintaan pindah masuk lewat
 * dukungan dan dikerjakan di sini, dengan jejak audit agar jelas siapa yang
 * memindahkan dan dari apa ke apa.
 */
export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-users-category", 30, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);

    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? "Permintaan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const profile = await prisma.businessProfile.findFirst({
      where: { userId: input.data.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, category: true },
    });
    if (!profile) {
      throw new ThreadsIntegrationError(
        "PROFILE_NOT_FOUND",
        "Pengguna ini belum mengisi profil bisnis, jadi belum ada kategori untuk dipindahkan.",
        404,
      );
    }
    if (profile.category === input.data.category) {
      throw new ThreadsIntegrationError("NO_CHANGE", "Kategori pengguna sudah bernilai itu.", 409);
    }

    await prisma.businessProfile.update({ where: { id: profile.id }, data: { category: input.data.category } });
    await recordAudit({
      actorId: actor.id,
      action: "BUSINESS_CATEGORY_CHANGED",
      entityType: "BusinessProfile",
      entityId: profile.id,
      metadata: { userId: input.data.userId, from: profile.category, to: input.data.category },
    });

    return NextResponse.json({ success: true, data: { category: input.data.category } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
