import { OnboardingShell } from "@/components/onboarding-shell";
import { ReplyModeStep } from "@/features/onboarding/components/reply-mode-step";

export default function ReplyModeOnboarding() { return <OnboardingShell step={4} title="Bagaimana balasan harus diproses?" copy="Mulai dengan pemeriksaan manual atau aktifkan otomatisasi terkontrol. Anda dapat mengubahnya kapan saja."><ReplyModeStep /></OnboardingShell>; }
