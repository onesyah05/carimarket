import { BrandLogo } from "@/components/brand-logo";

export function AuthShell({ children, title, copy }: { children: React.ReactNode; title: string; copy: string }) {
  return <main className="auth-page"><aside className="auth-aside"><BrandLogo /><div className="auth-aside__content"><h1>{title}</h1><p>{copy}</p></div><p className="auth-quote">“Konteks yang tepat membuat promosi terasa seperti bantuan.”</p></aside><section className="auth-main">{children}</section></main>;
}
