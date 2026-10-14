import { notFound } from "next/navigation";
import { PageHeading } from "@/components/dashboard-ui";
import { getSessionUser } from "@/server/auth/session";
import { getAccountOverview } from "@/server/settings/account";
import { requirePageRole } from "@/server/auth/page-guards";
import { InternalProfile } from "@/features/account/components/internal-profile";
import { isThreadsConfigured } from "@/server/integrations/threads/config";
import { listArticlesForCms } from "@/server/cms/articles";
import { serializeCmsArticle } from "@/server/cms/serialize";
import { listContactSubmissions, listFlaggedReplies, listMonitoringSnapshot, listPlatformUsers, listSupportTickets } from "@/server/admin/queries";
import { getWorkerStatus } from "@/server/jobs/runtime";
import { ContactSubmissionsTable, MonitoringPanels, ModerationQueue, TicketsTable, UsersTable } from "@/features/admin/components/internal-tables";
import { AddUserButton } from "@/features/admin/components/add-user-button";
import { ArticlesManager } from "@/features/cms/components/articles-manager";

const HEADINGS: Record<string, { title: string; copy: string }> = {
  pengguna: { title: "Pengguna", copy: "Daftarkan pelanggan baru dan lihat akun yang sudah ada. Menangguhkan akun dan mencabut koneksi tetap di tangan Superadmin." },
  tiket: { title: "Tiket dukungan", copy: "Tanggapi pertanyaan pengguna dan pesan dari formulir kontak tanpa membuka data sensitif." },
  moderasi: { title: "Moderasi balasan", copy: "Setujui draft yang lolos aturan atau tolak draft berisiko. Keputusan tercatat di audit log." },
  monitoring: { title: "Monitoring integrasi", copy: "Kesehatan integrasi 24 jam terakhir, read-only." },
  konten: { title: "Draft konten", copy: "Tulis dan edit draft artikel. Terbit memerlukan persetujuan Superadmin." },
  profil: { title: "Profil akun", copy: "Kelola identitas dan kata sandi akun internal Anda." },
};

export default async function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const heading = HEADINGS[section];
  if (!heading) notFound();

  if (section === "profil") {
    const actor = await requirePageRole(["ADMIN", "SUPERADMIN"], "/admin/profil");
    return <>
      <PageHeading eyebrow="Admin" title={heading.title} copy={heading.copy} />
      <InternalProfile account={await getAccountOverview(actor)} />
    </>;
  }

  if (section === "pengguna") {
    const users = await listPlatformUsers();
    return <>
      <PageHeading eyebrow="Admin" title={heading.title} copy={heading.copy} />
      <AddUserButton />
      <UsersTable users={users} canModerate={false} />
    </>;
  }

  if (section === "tiket") {
    const [tickets, submissions] = await Promise.all([listSupportTickets(), listContactSubmissions()]);
    return <>
      <PageHeading eyebrow="Admin" title={heading.title} copy={heading.copy} />
      <TicketsTable tickets={tickets} />
      <ContactSubmissionsTable submissions={submissions} />
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
