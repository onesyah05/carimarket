import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildThreadsAuthorizationUrl } from "@/server/integrations/threads/oauth";
import { getThreadsAppCredentialStatus, getThreadsConfig } from "@/server/integrations/threads/config";
import { getWorkspaceUser } from "@/server/workspace-user";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const config = getThreadsConfig();
    if (config.appUrl.protocol !== "https:" || new URL(request.url).protocol !== "https:") {
      throw new ThreadsIntegrationError(
        "THREADS_REQUIRES_HTTPS",
        "Buka Cari Market melalui alamat HTTPS untuk menghubungkan akun Threads.",
        400,
      );
    }
    const user = await getWorkspaceUser();
    if (user.role !== "USER") {
      throw new ThreadsIntegrationError("FORBIDDEN", "Hanya akun pengguna bisnis yang dapat menghubungkan Threads.", 403);
    }
    if (await getThreadsAppCredentialStatus() === "invalid") {
      const url = new URL("/dashboard/pengaturan", config.appUrl);
      url.searchParams.set("threads", "error");
      url.searchParams.set("threads_reason", "invalid_app_secret");
      return NextResponse.redirect(url);
    }
    const state = randomBytes(32).toString("base64url");
    const response = NextResponse.redirect(buildThreadsAuthorizationUrl(state));
    response.cookies.set("threads_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.appUrl.protocol === "https:",
      maxAge: 10 * 60,
      path: "/api/integrations/threads/callback",
    });
    return response;
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
