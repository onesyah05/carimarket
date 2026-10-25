import type { Metadata } from "next";
import { PageHeading } from "@/components/dashboard-ui";
import { KeywordManager } from "@/features/keywords/components/keyword-manager";

export const metadata: Metadata = { title: "Kata kunci", robots: { index: false, follow: false } };

export default function KeywordsPage() { return <><PageHeading eyebrow="Pencarian lead" title="Kata kunci" copy="Atur istilah yang ingin dicari dan percakapan yang harus dikecualikan." /><KeywordManager /></>; }
