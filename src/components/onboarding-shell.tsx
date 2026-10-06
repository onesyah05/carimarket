import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function OnboardingShell({ step, title, copy, children, total = 4 }: { step: number; title: string; copy: string; children: React.ReactNode; total?: number }) {
  return <main className="onboarding"><header><BrandLogo /><Link href="/dashboard">Lewati pengaturan</Link></header><div className="onboarding__body"><div className="onboarding__progress" aria-label={`Langkah ${step} dari ${total}`}><span style={{ width: `${step / total * 100}%` }} /></div><p className="eyebrow">Langkah {step} dari {total}</p><h1>{title}</h1><p className="onboarding__copy">{copy}</p>{children}</div></main>;
}
