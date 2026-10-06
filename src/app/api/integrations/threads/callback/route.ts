import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getThreadsConfig } from "@/server/integrations/threads/config";
import { saveThreadsConnection } from "@/server/integrations/threads/connection-service";
import { exchangeAuthorizationCode, exchangeLongLivedToken, getThreadsProfile } from "@/server/integrations/threads/oauth";
import { getWorkspaceUser } from "@/server/workspace-user";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export const runtime = "nodejs";

function equalState(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type FailureReason = "permission_denied" | "provider_error" | "missing_code" | "state_missing" | "state_mismatch" | "session_expired" | "token_exchange" | "invalid_app_secret" | "token_extend" | "profile" | "account_in_use" | "save_failed";

function settingsRedirect(status: "connected" | "error", reason?: FailureReason) {
  const url = new URL("/dashboard/pengaturan", getThreadsConfig().appUrl);
  url.searchParams.set("threads", status);
  if (reason) url.searchParams.set("threads_reason", reason);
  return url;
}

function redirectResult(status: "connected" | "error", reason?: FailureReason) {
  const response = NextResponse.redirect(settingsRedirect(status, reason));
  response.cookies.set("threads_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/api/integrations/threads/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const responseError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("threads_oauth_state")?.value;

  if (responseError) {
    return redirectResult("error", responseError === "access_denied" ? "permission_denied" : "provider_error");
  }
  if (!code || !state) return redirectResult("error", "missing_code");
  if (!expectedState) return redirectResult("error", "state_missing");
  if (!equalState(state, expectedState)) return redirectResult("error", "state_mismatch");

  let stage: FailureReason = "session_expired";
  try {
    const user = await getWorkspaceUser();
    stage = "token_exchange";
    const shortToken = await exchangeAuthorizationCode(code);
    stage = "token_extend";
    const longToken = await exchangeLongLivedToken(shortToken.access_token);
    stage = "profile";
    const profile = await getThreadsProfile(longToken.access_token);
    stage = "save_failed";
    await saveThreadsConnection({
      userId: user.id,
      externalAccountId: profile.id,
      username: profile.username,
      accessToken: longToken.access_token,
      expiresIn: longToken.expires_in,
    });

    return redirectResult("connected");
  } catch (error) {
    const reason = error instanceof ThreadsIntegrationError && error.code === "THREADS_ACCOUNT_IN_USE"
      ? "account_in_use"
      : error instanceof ThreadsIntegrationError && error.code === "META_101" && stage === "token_exchange"
        ? "invalid_app_secret"
      : stage;
    const safeCode = error instanceof ThreadsIntegrationError ? error.code : "INTERNAL_ERROR";
    console.warn(`Threads OAuth callback gagal pada tahap ${reason}: ${safeCode}`);
    return redirectResult("error", reason);
  }
}
