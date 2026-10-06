import { NextResponse } from "next/server";
import { disconnectThreads } from "@/server/integrations/threads/connection-service";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getWorkspaceUser();
    await disconnectThreads(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
