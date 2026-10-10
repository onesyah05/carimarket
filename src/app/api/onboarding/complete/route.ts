import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceSameOrigin } from "@/server/http/request-guards";
import { publicThreadsError, ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getSettingsUser } from "@/server/settings/user";
import { hasCompleteBusinessProfile } from "@/server/settings/business-profile";

export const runtime = "nodejs";

/** Menandai onboarding selesai setelah profil bisnis lengkap. */
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await getSettingsUser();
    const profile = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
    if (!hasCompleteBusinessProfile(profile)) {
      throw new ThreadsIntegrationError("PROFILE_INCOMPLETE", "Lengkapi profil bisnis terlebih dahulu.", 409);
    }
    const completedAt = profile?.onboardingCompletedAt ?? new Date();
    await prisma.businessProfile.update({ where: { userId: user.id }, data: { onboardingCompletedAt: completedAt } });
    return NextResponse.json({ success: true, data: { completedAt: completedAt.toISOString() } });
  } catch (error) {
    const result = publicThreadsError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
