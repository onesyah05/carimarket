import { notFound } from "next/navigation";
import { PageHeading } from "@/components/dashboard-ui";
import { getSessionUser } from "@/server/auth/session";
import { getAccountOverview } from "@/server/settings/account";
import { requirePageRole } from "@/server/auth/page-guards";
import { InternalProfile } from "@/features/account/components/internal-profile";
import { isThreadsConfigured } from "@/server/integrations/threads/config";
import { listArticlesForCms } from "@/server/cms/articles";
import { serializeCmsArticle } from "@/server/cms/serialize";
import { listFlaggedReplies, listMonitoringSnapshot } from "@/server/admin/queries";
import { runTable, tableSearchHint } from "@/server/admin/tables/registry";
import { listTicketsForInternal } from "@/server/support/tickets";
import { getWorkerStatus } from "@/server/jobs/runtime";
import { MonitoringPanels, ModerationQueue } from "@/features/admin/components/internal-tables";
import { UsersTable } from "@/features/admin/components/tables/users-table";
import { ContactTable } from "@/features/admin/components/tables/console-tables";
import { StaffTicketConsole } from "@/features/support/components/staff-ticket-console";
import { AddUserButton } from "@/features/admin/components/add-user-button";
import { ArticlesManager } from "@/features/cms/components/articles-manager";

const HEADINGS: Record<string, { title: string; copy: string }> = {
  pengguna: { title: "Pengguna", copy: "Daftarkan pelanggan baru dan lihat akun yang sudah ada. Menangguhkan akun dan mencabut koneksi tetap di tangan Superadmin." },
  tiket: { title: "Tiket dukungan", copy: "Jawab tiket pengguna, catat konteks penanganan secara internal, dan tinjau pesan dari formulir kontak. Billing dan kredensial tetap di luar jangkauan." },
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
    const users = await runTable("users", "ADMIN", {});
    return <>
      <PageHeading eyebrow="Admin" title={heading.title} copy={heading.copy} />
      <UsersTable
        initial={users}
        searchHint={tableSearchHint("users")}
        canModerate={false}
        detailBase="/admin/pengguna"
        action={<AddUserButton />}
      />
    </>;
  }

  if (section === "tiket") {
    const [tickets, submissions] = await Promise.all([listTicketsForInternal(), runTable("contact", "ADMIN", {})]);
    return <>
      <PageHeading eyebrow="Admin" title={heading.title} copy={heading.copy} />
      <StaffTicketConsole tickets={tickets} />
      <ContactTable initial={submissions} searchHint={tableSearchHint("contact")} />
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
