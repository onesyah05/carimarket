import { NextResponse } from "next/server";
import { getThreadsConnectionStatus } from "@/server/integrations/threads/connection-service";
import { getThreadsAdapter } from "@/server/integrations/threads";
import { getThreadsAppCredentialStatus, getThreadsConfig } from "@/server/integrations/threads/config";
import { getUnofficialCredentialsStatus } from "@/server/integrations/threads/unofficial-credentials";
import { publicThreadsError } from "@/server/integrations/threads/errors";
import { getWorkspaceUser } from "@/server/workspace-user";

export const runtime = "nodejs";

async function connectionAvailability(request: Request) {
  try {
    const configured = getThreadsConfig().appUrl.protocol === "https:";
    const requiresHttps = configured && new URL(request.url).protocol !== "https:";
    const credentialsInvalid = configured && !requiresHttps && await getThreadsAppCredentialStatus() === "invalid";
    return { configured: configured && !requiresHttps && !credentialsInvalid, requiresHttps, credentialsInvalid };
  } catch {
    return { configured: false, requiresHttps: false, credentialsInvalid: false };
  }
}

export async function GET(request: Request) {
  try {
    const user = await getWorkspaceUser();
    const [connection, searchPreview] = await Promise.all([
      getThreadsConnectionStatus(user.id),
      getUnofficialCredentialsStatus(),
    ]);
    const { configured, requiresHttps, credentialsInvalid } = await connectionAvailability(request);
    if (!connection) {
      return NextResponse.json({
        success: true,
        data: { configured, requiresHttps, credentialsInvalid, connected: false, searchPreviewAvailable: searchPreview.configured, username: null, publishingLimit: null },
      });
    }

    // Ambil kuota asli Meta (publish + reply, 24 jam). Jangan gagalkan endpoint
    // hanya karena pembacaan kuota bermasalah — status koneksi tetap yang utama.
    let publishingLimit = null;
    try {
      const adapter = await getThreadsAdapter(user.id);
      publishingLimit = await adapter.getPublishingLimit();
    } catch {
      publishingLimit = null;
    }

    const tokenShortLived = connection.tokenKind === "SHORT_LIVED";
    const scopes = connection.scopes;
    const needsReconnectForReplies = !Array.isArray(scopes) ||
      !["threads_read_replies", "threads_manage_replies"].every(scope => scopes.includes(scope));

    return NextResponse.json({
      success: true,
      data: {
        configured,
        requiresHttps,
        credentialsInvalid,
        connected: true,
        searchPreviewAvailable: searchPreview.configured,
        username: connection.username,
        tokenShortLived,
        tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
        needsReconnectForReplies,
        publishingLimit,
        mode: "official",
      },
    });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
