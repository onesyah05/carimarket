import { ThreadsOnboardingStep } from "@/features/onboarding/components/threads-step";
import { requireOnboardingProfile } from "@/server/onboarding/guards";

export default async function ThreadsOnboarding() {
  await requireOnboardingProfile("/onboarding/threads");
  return <ThreadsOnboardingStep />;
}
