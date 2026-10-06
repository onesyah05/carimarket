import { OnboardingShell } from "@/components/onboarding-shell";
import { KeywordStep } from "@/features/onboarding/components/keyword-step";

export default function KeywordOnboarding() { return <OnboardingShell step={3} title="Apa yang calon pelanggan cari?" copy="Mulai dengan dua atau tiga frasa yang biasa digunakan orang saat membutuhkan layanan Anda."><KeywordStep /></OnboardingShell>; }
