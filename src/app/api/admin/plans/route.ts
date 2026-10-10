import { NextResponse } from "next/server";
import { requireApiRole } from "@/server/auth/api-guards";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { createPlan, createPlanSchema, listPlansForAdmin } from "@/server/plans/admin";
import { PLAN_CATALOG } from "../../../../../prisma/plan-catalog";

export const runtime = "nodejs";

const catalogCodes = PLAN_CATALOG.map(entry => entry.code);

/** Daftar paket beserta pemakaian dan peringatan kuota. */
export async function GET() {
  try {
    await requireApiRole(["SUPERADMIN"]);
    return NextResponse.json({ success: true, data: await listPlansForAdmin(catalogCodes) });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/** Menambah paket baru. Kuota divalidasi terhadap jadwal dan batas Meta. */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-plans", 30, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);
    const input = createPlanSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message ?? "Data paket tidak valid.", code: "INVALID_INPUT" }, { status: 400 });
    }
    await createPlan(actor, input.data);
    return NextResponse.json({ success: true, data: await listPlansForAdmin(catalogCodes) }, { status: 201 });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
