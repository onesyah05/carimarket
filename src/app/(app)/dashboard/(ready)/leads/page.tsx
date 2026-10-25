import type { Metadata } from "next";
import { PageHeading } from "@/components/dashboard-ui";
import { LeadFeed } from "@/features/leads/components/lead-feed";

export const metadata: Metadata = { title: "Lead", robots: { index: false, follow: false } };

export default function LeadsPage() { return <><PageHeading eyebrow="Peluang terbaru" title="Lead feed" copy="Percakapan yang cocok dengan kata kunci dan profil bisnis Anda." /><LeadFeed /></>; }
