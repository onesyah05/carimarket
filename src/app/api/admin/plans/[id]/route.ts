import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { listPlansForAdmin, updatePlan, updatePlanSchema } from "@/server/plans/admin";
import { PLAN_CATALOG } from "../../../../../../prisma/plan-catalog";

export const runtime = "nodejs";

const catalogCodes = PLAN_CATALOG.map(entry => entry.code);

/** Mengubah harga, kuota, jadwal, atau status aktif sebuah paket. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-plans", 60, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);
    const { id } = await params;
    const input = updatePlanSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Data paket tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }
    await updatePlan(actor, id, input.data);
    return NextResponse.json({ success: true, data: await listPlansForAdmin(catalogCodes) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
