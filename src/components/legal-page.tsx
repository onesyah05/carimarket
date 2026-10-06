import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: [string, string][] }) {
  return <><PublicHeader /><main><section className="page-hero"><div className="container"><p className="eyebrow">Legal</p><h1>{title}</h1><p>{intro}</p></div></section><section className="content-page"><div className="content-narrow"><p><strong>Terakhir diperbarui:</strong> 29 September 2026</p>{sections.map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}</div></section></main><PublicFooter /></>;
}
