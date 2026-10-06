import { notFound } from "next/navigation";
import { PageHeading } from "@/components/dashboard-ui";
import { getSessionUser } from "@/server/auth/session";
import { isThreadsConfigured } from "@/server/integrations/threads/config";
import { listArticlesForCms } from "@/server/cms/articles";
import { serializeCmsArticle } from "@/server/cms/serialize";
import { listFlaggedReplies, listMonitoringSnapshot, listSupportTickets } from "@/server/admin/queries";
import { getWorkerStatus } from "@/server/jobs/runtime";
import { MonitoringPanels, ModerationQueue, TicketsTable } from "@/features/admin/components/internal-tables";
import { ArticlesManager } from "@/features/cms/components/articles-manager";

const HEADINGS: Record<string, { title: string; copy: string }> = {
  tiket: { title: "Tiket dukungan", copy: "Tanggapi pertanyaan pengguna tanpa membuka data sensitif." },
  moderasi: { title: "Moderasi balasan", copy: "Setujui draft yang lolos aturan atau tolak draft berisiko. Keputusan tercatat di audit log." },
  monitoring: { title: "Monitoring integrasi", copy: "Kesehatan integrasi 24 jam terakhir, read-only." },
  konten: { title: "Draft konten", copy: "Tulis dan edit draft artikel. Terbit memerlukan persetujuan Superadmin." },
};

export default async function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const heading = HEADINGS[section];
  if (!heading) notFound();

  if (section === "tiket") {
    const tickets = await listSupportTickets();
    return <>
      <PageHeading eyebrow="Admin" title={heading.title} copy={heading.copy} />
      <TicketsTable tickets={tickets} />
    </>;
  }

  if (section === "moderasi") {
    const flagged = await listFlaggedReplies();
    return <>
      <PageHeading eyebrow="Admin" title={heading.title} copy={heading.copy} />
      <ModerationQueue drafts={flagged} />
      <p className="panel-note">Menyetujui mengembalikan draft ke antrean tinjauan pengguna. Menolak membatalkan draft.</p>
    </>;
  }

  if (section === "monitoring") {
    const snapshot = await listMonitoringSnapshot();
    return <>
      <PageHeading eyebrow="Admin" title={heading.title} copy={heading.copy} />
      <MonitoringPanels snapshot={snapshot} threadsReady={isThreadsConfigured()} worker={getWorkerStatus()} />
    </>;
  }

  const user = await getSessionUser();
  const articles = await listArticlesForCms();
  return <>
    <PageHeading eyebrow="Admin" title={heading.title} copy={heading.copy} />
    <ArticlesManager role="ADMIN" userId={user?.id ?? ""} articles={articles.map(serializeCmsArticle)} />
  </>;
}
