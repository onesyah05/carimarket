import { requirePageUser } from "@/server/auth/page-guards";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser("/onboarding");
  return <>{children}</>;
}
