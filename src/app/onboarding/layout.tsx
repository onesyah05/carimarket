import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/server/auth/page-guards";
import { hasCompleteBusinessProfile } from "@/server/settings/business-profile";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole(["USER"], "/onboarding");
  const profile = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
  if (!hasCompleteBusinessProfile(profile)) redirect("/dashboard/pengaturan");
  return <>{children}</>;
}
