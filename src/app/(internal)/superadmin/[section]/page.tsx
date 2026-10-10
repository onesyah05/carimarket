import { notFound } from "next/navigation";
import { PageHeading } from "@/components/dashboard-ui";
import { getSessionUser } from "@/server/auth/session";
import { requirePageRole } from "@/server/auth/page-guards";
import { getAccountOverview } from "@/server/settings/account";
import { InternalProfile } from "@/features/account/components/internal-profile";
import {
  listAdmins,
  listAuditLog,
  listBlacklistTerms,
  listContactSubmissions,
  listConnections,
  listFlaggedReplies,
  listModerationStats,
  listPlatformUsers,
} from "@/server/admin/queries";
import { listArticlesForCms } from "@/server/cms/articles";
import { serializeCmsArticle } from "@/server/cms/serialize";
import { getWorkerStatus } from "@/server/jobs/runtime";
import { getUnofficialCredentialsStatus } from "@/server/integrations/threads/unofficial-credentials";
import { getThreadsConfig, getThreadsOAuthReadiness } from "@/server/integrations/threads/config";
import { AuditTable, ConnectionsTable, ContactSubmissionsTable, ModerationQueue, SystemStateTable, UsersTable } from "@/features/admin/components/internal-tables";
import { PlansManager } from "@/features/admin/components/plans-manager";
import { listPlansForAdmin } from "@/server/plans/admin";
import { PLAN_CATALOG } from "../../../../../prisma/plan-catalog";
import { ApiDocs } from "@/features/admin/components/api-docs";
import { listCredentials } from "@/server/api/credentials";
import { AdminsManager } from "@/features/admin/components/admins-manager";
import { BlacklistManager } from "@/features/admin/components/blacklist-manager";
import { ThreadsCredentialsManager } from "@/features/admin/components/threads-credentials-manager";
import { ArticlesManager } from "@/features/cms/components/articles-manager";

const HEADINGS: Record<string, { title: string; copy: string }> = {
  admin: { title: "Manajemen Admin", copy: "Promosikan akun pengguna menjadi Admin dan atur permission mereka." },
  users: { title: "Manajemen Pengguna", copy: "Pantau akun, paket, dan status koneksi. Token tidak pernah ditampilkan di panel ini." },
  paket: { title: "Paket dan billing", copy: "Tambah dan ubah paket langganan. Harga serta kuota di sini langsung berlaku di halaman harga dan penegakan kuota." },
  kuota: { title: "Kuota API", copy: "Status koneksi Threads dan pemakaian agregat per pengguna." },
  kepatuhan: { title: "Kepatuhan", copy: "Kelola istilah terlarang dan pantau antrean moderasi lintas tim." },
  sistem: { title: "Pengaturan Sistem", copy: "Kondisi integrasi yang sebenarnya; nilai rahasia tidak pernah ditampilkan." },
  integrasi: { title: "Integrasi Threads", copy: "Periksa koneksi resmi Threads dan pencarian pratinjau sebelum App Review." },
  api: { title: "API Mobile", copy: "Dokumentasi API aplikasi mobile dan daftar token aktif. Halaman ini hanya dapat diakses Superadmin." },
  kontak: { title: "Pesan kontak", copy: "Pesan dari formulir kontak publik, tersimpan di database platform." },
  profil: { title: "Profil akun", copy: "Kelola identitas dan kata sandi akun Superadmin Anda." },
  audit: { title: "Audit Log", copy: "Jejak aktivitas kritikal platform, terekam otomatis dari aplikasi." },
  konten: { title: "Manajemen Konten", copy: "Tulis, jadwalkan, dan terbitkan artikel blog. Admin mengajukan review, Superadmin menerbitkan." },
};

export default async function SuperSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const heading = HEADINGS[section];
  if (!heading) notFound();

  if (section === "profil") {
    const actor = await requirePageRole(["SUPERADMIN"], "/superadmin/profil");
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <InternalProfile account={await getAccountOverview(actor)} />
    </>;
  }

  if (section === "admin") {
    const admins = await listAdmins();
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <AdminsManager admins={admins.map(admin => ({ id: admin.id, name: admin.name, email: admin.email, role: admin.role, status: admin.status, permissions: admin.adminPermissions.map(item => item.permission) }))} />
    </>;
  }

  if (section === "users") {
    const users = await listPlatformUsers();
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <UsersTable users={users} />
    </>;
  }

  if (section === "paket") {
    const plans = await listPlansForAdmin(PLAN_CATALOG.map(entry => entry.code));
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <PlansManager plans={plans} />
    </>;
  }

  if (section === "kuota") {
    const connections = await listConnections();
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <ConnectionsTable connections={connections} />
    </>;
  }

  if (section === "kepatuhan") {
    const [stats, terms, flagged] = await Promise.all([listModerationStats(), listBlacklistTerms(), listFlaggedReplies()]);
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <section className="stat-grid">
        <article className="stat-card"><span>Penandaan terbuka</span><strong>{stats.openFlags}</strong><p>{stats.openFlags > 0 ? "Menunggu keputusan tim moderasi" : "Antrean bersih"}</p></article>
        <article className="stat-card"><span>Penandaan selesai</span><strong>{stats.resolvedFlags}</strong><p>Keputusan tercatat di audit log</p></article>
        <article className="stat-card"><span>Istilah terlarang aktif</span><strong>{stats.activeTerms}</strong><p>Dipakai untuk menahan draft berisiko</p></article>
      </section>
      <BlacklistManager terms={terms.map(term => ({ id: term.id, term: term.term, reason: term.reason, createdAt: term.createdAt.toISOString(), creator: term.createdBy?.name ?? null }))} />
      {flagged.length > 0 && <>
        <h2 className="section-subtitle">Draft tertanda terbaru</h2>
        <ModerationQueue drafts={flagged} />
      </>}
    </>;
  }

  if (section === "sistem") {
    const threadsOAuthStatus = await getThreadsOAuthReadiness();
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <SystemStateTable worker={getWorkerStatus()} threadsOAuthStatus={threadsOAuthStatus} />
    </>;
  }

  if (section === "integrasi") {
    const [credentialsStatus, oauthStatus] = await Promise.all([getUnofficialCredentialsStatus(), getThreadsOAuthReadiness()]);
    let callbackUrl = "";
    try { callbackUrl = getThreadsConfig().redirectUri; } catch { /* Konfigurasi belum lengkap. */ }
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <section className="panel mini-form-panel">
        <strong>Koneksi akun Threads resmi</strong>
        <p>{oauthStatus === "valid" ? "Threads App ID dan App Secret diterima Meta. Pengguna dapat menghubungkan akun melalui OAuth." : oauthStatus === "invalid" ? "Threads App Secret yang terpasang ditolak Meta. Perbarui THREADS_APP_SECRET dengan Threads App Secret dari Meta App Dashboard, lalu mulai ulang aplikasi." : oauthStatus === "unavailable" ? "Validasi kredensial ke Meta belum berhasil. Coba lagi saat koneksi tersedia." : "THREADS_APP_ID, THREADS_APP_SECRET, atau alamat aplikasi belum lengkap."}</p>
        <div className="status-row"><span>Status:</span><strong className={oauthStatus === "valid" ? "status-ok" : "status-warn"}>{oauthStatus === "valid" ? "Siap" : oauthStatus === "invalid" ? "Secret ditolak Meta" : oauthStatus === "unavailable" ? "Belum terverifikasi" : "Belum dikonfigurasi"}</strong></div>
        {callbackUrl && <div className="status-row"><span>URL callback:</span><span>{callbackUrl}</span></div>}
      </section>
      <ThreadsCredentialsManager status={credentialsStatus} />
    </>;
  }

  if (section === "api") {
    const credentials = await listCredentials();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} action={<a className="button button--ghost" href="/api/admin/api-docs" download>Unduh OpenAPI</a>} />
      <ApiDocs baseUrl={baseUrl} credentials={credentials} />
    </>;
  }

  if (section === "kontak") {
    const submissions = await listContactSubmissions();
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <ContactSubmissionsTable submissions={submissions} />
    </>;
  }

  if (section === "audit") {
    const entries = await listAuditLog();
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <AuditTable entries={entries} />
    </>;
  }

  const user = await getSessionUser();
  const articles = await listArticlesForCms();
  return <>
    <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
    <ArticlesManager role="SUPERADMIN" userId={user?.id ?? ""} articles={articles.map(serializeCmsArticle)} />
  </>;
}
