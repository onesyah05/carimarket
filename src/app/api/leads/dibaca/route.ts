import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { requireEntitledUser } from "@/server/auth/access-gate";

export const runtime = "nodejs";

/** POST — menandai seluruh lead yang belum dibaca sebagai sudah dibaca. */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireEntitledUser();
    const result = await prisma.lead.updateMany({
      where: { userId: user.id, viewedAt: null },
      data: { viewedAt: new Date() },
    });
    return NextResponse.json({ success: true, data: { marked: result.count } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
