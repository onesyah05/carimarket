import { NextResponse } from "next/server";
import { destroyCurrentSession, getSessionUser } from "@/server/auth/session";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getSessionUser();
    await destroyCurrentSession();
    if (user) {
      await prisma.auditLog.create({
        data: { actorId: user.id, action: "AUTH_LOGOUT", entityType: "User", entityId: user.id },
      }).catch(() => undefined);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
