import { OnboardingShell } from "@/components/onboarding-shell";
import { BusinessStep } from "@/features/onboarding/components/business-step";
import { requirePageRole } from "@/server/auth/page-guards";
import { resolveActiveProfile } from "@/server/workspace/profiles";

export default async function BusinessOnboarding() {
  const user = await requirePageRole(["USER"], "/onboarding/bisnis");
  const profile = await resolveActiveProfile(user);
  return <OnboardingShell step={1} allowSkip={false} title="Ceritakan bisnis Anda." copy="Konteks ini membantu Cari Market menilai relevansi dan menyiapkan draft balasan yang sesuai.">
    <BusinessStep initialProfile={{
      name: profile?.name ?? "",
      category: profile?.category ?? "",
      serviceArea: profile?.serviceArea ?? "",
      description: profile?.description ?? "",
    }} />
  </OnboardingShell>;
}
