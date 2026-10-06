import { NextResponse } from "next/server";
import { recordAudit } from "@/server/audit";
import { requireApiRole } from "@/server/auth/api-guards";
import { getWorkerStatus, runCycle } from "@/server/jobs/runtime";
import { enforceRateLimit, enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireApiRole(["ADMIN", "SUPERADMIN"]);
    return NextResponse.json({ success: true, data: getWorkerStatus() });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceRateLimit("admin-jobs", 10, 60_000);
    const actor = await requireApiRole(["SUPERADMIN"]);
    const result = await runCycle();
    await recordAudit({ actorId: actor.id, action: "WORKER_CYCLE_TRIGGERED", entityType: "Worker", metadata: result.summary as Record<string, number> ?? {} });
    return NextResponse.json({ success: true, data: { ...result, status: getWorkerStatus() } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
