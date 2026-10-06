import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeading } from "@/components/dashboard-ui";
import { ReplyModeSummary } from "@/features/replies/components/reply-mode-summary";
import { DashboardDataPanels, ThreadsStatusCard } from "@/features/dashboard/components/dashboard-data-panels";

export default function DashboardPage() {
  return <>
    <PageHeading eyebrow="Workspace bisnis" title="Pantau lead dan alur balasan." copy="Temukan peluang baru, lalu biarkan mode balasan workspace menentukan langkah berikutnya." action={<Link className="button button--primary" href="/dashboard/leads"><Search size={16} /> Cari di lead</Link>} />
    <section className="dashboard-priority-grid">
      <DashboardDataPanels />
      <aside className="dashboard-rail">
        <ReplyModeSummary />
        <ThreadsStatusCard />
      </aside>
    </section>
  </>;
}
