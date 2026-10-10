import { OnboardingShell } from "@/components/onboarding-shell";
import { ReplyModeStep } from "@/features/onboarding/components/reply-mode-step";
import { requireOnboardingProfile } from "@/server/onboarding/guards";

export default async function ReplyModeOnboarding() {
  await requireOnboardingProfile("/onboarding/balasan");
  return <OnboardingShell step={4} title="Bagaimana balasan harus diproses?" copy="Mulai dengan pemeriksaan manual atau aktifkan otomatisasi terkontrol. Anda dapat mengubahnya kapan saja."><ReplyModeStep /></OnboardingShell>;
}
