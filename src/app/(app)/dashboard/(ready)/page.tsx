import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeading } from "@/components/dashboard-ui";
import { ReplyModeSummary } from "@/features/replies/components/reply-mode-summary";
import { DashboardOverview, ThreadsStatusCard } from "@/features/dashboard/components/dashboard-data-panels";

export const metadata: Metadata = { title: "Ringkasan", robots: { index: false, follow: false } };

export default function DashboardPage() {
  return <>
    <PageHeading eyebrow="Workspace bisnis" title="Pantau lead dan alur balasan." copy="Temukan peluang baru, lalu biarkan mode balasan workspace menentukan langkah berikutnya." action={<Link className="button button--primary" href="/dashboard/leads"><Search size={16} /> Cari di lead</Link>} />
    <DashboardOverview>
      <ReplyModeSummary />
      <ThreadsStatusCard />
    </DashboardOverview>
  </>;
}
