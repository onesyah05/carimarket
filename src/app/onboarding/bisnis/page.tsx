import { OnboardingShell } from "@/components/onboarding-shell";
import { BusinessStep } from "@/features/onboarding/components/business-step";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/server/auth/page-guards";

export default async function BusinessOnboarding() {
  const user = await requirePageRole(["USER"], "/onboarding/bisnis");
  const profile = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
  return <OnboardingShell step={1} allowSkip={false} title="Ceritakan bisnis Anda." copy="Konteks ini membantu Cari Market menilai relevansi dan menyiapkan draft balasan yang sesuai.">
    <BusinessStep initialProfile={{
      name: profile?.name ?? "",
      category: profile?.category ?? "",
      serviceArea: profile?.serviceArea ?? "",
      description: profile?.description ?? "",
    }} />
  </OnboardingShell>;
}
