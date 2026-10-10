import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function OnboardingShell({ step, title, copy, children, total = 4, allowSkip = true }: { step: number; title: string; copy: string; children: React.ReactNode; total?: number; allowSkip?: boolean }) {
  // Langkah profil bisnis wajib, jadi tautan lewati disembunyikan di sana.
  return <main className="onboarding"><header><BrandLogo />{allowSkip ? <Link href="/dashboard">Lewati pengaturan</Link> : <span className="onboarding__required">Langkah wajib</span>}</header><div className="onboarding__body"><div className="onboarding__progress" aria-label={`Langkah ${step} dari ${total}`}><span style={{ width: `${step / total * 100}%` }} /></div><p className="eyebrow">Langkah {step} dari {total}</p><h1>{title}</h1><p className="onboarding__copy">{copy}</p>{children}</div></main>;
}
