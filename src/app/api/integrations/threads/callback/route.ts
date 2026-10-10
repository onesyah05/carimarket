import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getThreadsConfig } from "@/server/integrations/threads/config";
import { saveThreadsConnection } from "@/server/integrations/threads/connection-service";
import { exchangeAuthorizationCode, exchangeLongLivedToken, getThreadsProfile } from "@/server/integrations/threads/oauth";
import { getWorkspaceUser } from "@/server/workspace-user";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { createSession } from "@/server/auth/session";
import { hasCompleteBusinessProfile } from "@/server/settings/business-profile";

export const runtime = "nodejs";

function equalState(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type FailureReason = "permission_denied" | "provider_error" | "missing_code" | "state_missing" | "state_mismatch" | "session_expired" | "token_exchange" | "invalid_app_secret" | "token_extend" | "profile" | "account_in_use" | "save_failed" | "signup_disabled";

/**
 * Pendaftaran lewat Threads membuat akun baru tanpa email terverifikasi karena
 * Meta tidak membagikan alamat email. Akun seperti itu diberi email placeholder
 * yang ditandai eksplisit (`emailIsPlaceholder`) supaya tidak pernah dianggap
 * alamat yang dapat dihubungi, dan pembuatannya tercatat di audit log.
 * Setel THREADS_SIGNUP_ENABLED="false" untuk membatasi OAuth hanya pada akun
 * yang sudah masuk.
 */
function isThreadsSignupEnabled() {
  return process.env.THREADS_SIGNUP_ENABLED !== "false";
}

function placeholderEmail(threadsAccountId: string) {
  return `threads-${threadsAccountId}@placeholder.carimarket.invalid`;
}

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
    const user = await getWorkspaceUser().catch(() => null);
    stage = "token_exchange";
    const shortToken = await exchangeAuthorizationCode(code);
    stage = "token_extend";
    const longToken = await exchangeLongLivedToken(shortToken.access_token);
    stage = "profile";
    const profile = await getThreadsProfile(longToken.access_token);
    stage = "save_failed";

    let targetUserId = user?.id;
    if (!targetUserId) {
      const existingConnection = await prisma.threadsConnection.findUnique({ where: { externalAccountId: profile.id } });
      if (existingConnection) {
        targetUserId = existingConnection.userId;
      } else {
        if (!isThreadsSignupEnabled()) return redirectResult("error", "signup_disabled");
        const newUser = await prisma.user.create({
          data: {
            email: placeholderEmail(profile.id),
            emailIsPlaceholder: true,
            name: profile.username,
            role: "USER",
            status: "ACTIVE",
          }
        });
        targetUserId = newUser.id;
        await recordAudit({
          actorId: newUser.id,
          action: "AUTH_THREADS_SIGNUP",
          entityType: "User",
          entityId: newUser.id,
          metadata: { emailVerified: false, emailIsPlaceholder: true },
        });
      }
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      await createSession(targetUserId, { ip, userAgent: request.headers.get("user-agent") ?? undefined });
      await prisma.user.update({ where: { id: targetUserId }, data: { lastLoginAt: new Date() } });
    }

    await saveThreadsConnection({
      userId: targetUserId,
      externalAccountId: profile.id,
      username: profile.username,
      accessToken: longToken.access_token,
      expiresIn: longToken.expires_in,
    });

    if (!user) {
      const businessProfile = await prisma.businessProfile.findUnique({ where: { userId: targetUserId } });
      const destination = hasCompleteBusinessProfile(businessProfile) ? "/dashboard" : "/onboarding/bisnis";
      const response = NextResponse.redirect(new URL(destination, getThreadsConfig().appUrl));
      response.cookies.set("threads_oauth_state", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/api/integrations/threads/callback", maxAge: 0 });
      return response;
    }

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
