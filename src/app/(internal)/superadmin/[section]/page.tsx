import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PageHeading } from "@/components/dashboard-ui";
import { getSessionUser } from "@/server/auth/session";
import { requirePageRole } from "@/server/auth/page-guards";
import { getAccountOverview } from "@/server/settings/account";
import { InternalProfile } from "@/features/account/components/internal-profile";
import { listFlaggedReplies, listModerationStats } from "@/server/admin/queries";
import { runTable, tableSearchHint } from "@/server/admin/tables/registry";
import { listArticlesForCms } from "@/server/cms/articles";
import { serializeCmsArticle } from "@/server/cms/serialize";
import { getWorkerStatus } from "@/server/jobs/runtime";
import { getUnofficialCredentialsStatus } from "@/server/integrations/threads/unofficial-credentials";
import { getThreadsConfig, getThreadsOAuthReadiness } from "@/server/integrations/threads/config";
import { ModerationQueue, SystemStateTable } from "@/features/admin/components/internal-tables";
import { UsersTable } from "@/features/admin/components/tables/users-table";
import {
  AdminsTable,
  ArticlesTable,
  AuditTable,
  BlacklistTable,
  ConnectionsTable,
  ContactTable,
  CredentialsTable,
  TransactionsTable,
} from "@/features/admin/components/tables/console-tables";
import { PlansManager } from "@/features/admin/components/plans-manager";
import { PaymentMethodsManager } from "@/features/billing/components/payment-methods-manager";
import { TransactionsReview } from "@/features/billing/components/transactions-review";
import { listPlansForAdmin } from "@/server/plans/admin";
import { listPaymentMethodsForAdmin } from "@/server/billing/payment-methods";
import { listTransactionsForAdmin } from "@/server/billing/transactions";
import { PLAN_CATALOG } from "../../../../../prisma/plan-catalog";
import { ApiDocs } from "@/features/admin/components/api-docs";
import { listCredentials } from "@/server/api/credentials";
import { AddUserButton } from "@/features/admin/components/add-user-button";
import { LeadSearchConsole } from "@/features/admin/components/lead-search-console";
import { AdminsManager } from "@/features/admin/components/admins-manager";
import { ThreadsCredentialsManager } from "@/features/admin/components/threads-credentials-manager";
import { ArticlesManager } from "@/features/cms/components/articles-manager";
import { PlatformUsagePanel } from "@/features/admin/components/platform-usage-panel";
import { SiteContentManager } from "@/features/cms/components/site-content-manager";
import { listFaqsForCms } from "@/server/cms/faq";
import { listStaticPagesForCms } from "@/server/cms/static-pages";
import { platformUsageToday } from "@/server/usage/service";

const HEADINGS: Record<string, { title: string; copy: string }> = {
  admin: { title: "Manajemen Admin", copy: "Promosikan akun pengguna menjadi Admin dan atur permission mereka." },
  "cari-lead": { title: "Cari lead", copy: "Telusuri percakapan Threads dengan kata kunci apa pun. Tanpa batas kata kunci dan tanpa memakai kuota, karena hasilnya tidak disimpan sebagai lead." },
  users: { title: "Manajemen Pengguna", copy: "Pantau akun, paket, dan status koneksi. Token tidak pernah ditampilkan di panel ini." },
  paket: { title: "Paket dan billing", copy: "Tambah dan ubah paket langganan. Harga serta kuota di sini langsung berlaku di halaman harga dan penegakan kuota." },
  pembayaran: { title: "Verifikasi pembayaran", copy: "Cocokkan nominal beserta kode uniknya dengan mutasi rekening. Menyetujui pembayaran langsung mengaktifkan paket pelanggan." },
  "metode-pembayaran": { title: "Metode pembayaran", copy: "Rekening, e-wallet, dan QRIS yang ditampilkan kepada pelanggan saat membuat tagihan upgrade." },
  kuota: { title: "Kuota API", copy: "Pemakaian harian tingkat platform terhadap batas Meta, lalu status koneksi Threads per pengguna." },
  kepatuhan: { title: "Kepatuhan", copy: "Kelola istilah terlarang dan pantau antrean moderasi lintas tim." },
  sistem: { title: "Pengaturan Sistem", copy: "Kondisi integrasi yang sebenarnya; nilai rahasia tidak pernah ditampilkan." },
  integrasi: { title: "Integrasi Threads", copy: "Periksa koneksi resmi Threads dan pencarian pratinjau sebelum App Review." },
  api: { title: "API Mobile", copy: "Dokumentasi API aplikasi mobile dan daftar token aktif. Halaman ini hanya dapat diakses Superadmin." },
  kontak: { title: "Pesan kontak", copy: "Pesan dari formulir kontak publik, tersimpan di database platform." },
  profil: { title: "Profil akun", copy: "Kelola identitas dan kata sandi akun Superadmin Anda." },
  audit: { title: "Audit Log", copy: "Jejak aktivitas kritikal platform, terekam otomatis dari aplikasi." },
  konten: { title: "Manajemen Konten", copy: "Tulis, jadwalkan, dan terbitkan artikel blog. Admin mengajukan review, Superadmin menerbitkan." },
  "halaman-publik": { title: "Teks halaman publik", copy: "Pertanyaan umum dan teks halaman statis. Perubahan langsung berlaku di beranda, halaman harga, dan structured data FAQPage tanpa deploy." },
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
    // Daftar akun internal memakai DataTable, sedangkan pengaturan permission
    // per akun tetap di AdminsManager karena kontrolnya per baris.
    const admins = await runTable("admins", "SUPERADMIN", {});
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <AdminsTable initial={admins} searchHint={tableSearchHint("admins")} />
      <AdminsManager admins={admins.rows.map(row => ({
        id: String(row.id),
        name: String(row.name),
        email: String(row.email),
        role: row.role as "ADMIN" | "SUPERADMIN",
        status: String(row.status),
        permissions: (row.permissions as string[]) ?? [],
      }))} />
    </>;
  }

  if (section === "cari-lead") {
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <LeadSearchConsole />
    </>;
  }

  if (section === "users") {
    const users = await runTable("users", "SUPERADMIN", {});
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <UsersTable
        initial={users}
        searchHint={tableSearchHint("users")}
        detailBase="/superadmin/users"
        action={<AddUserButton />}
      />
    </>;
  }

  if (section === "paket") {
    const plans = await listPlansForAdmin(PLAN_CATALOG.map(entry => entry.code));
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <PlansManager plans={plans} />
    </>;
  }

  if (section === "pembayaran") {
    const [methods, transactions, transactionRows] = await Promise.all([
      listPaymentMethodsForAdmin(),
      listTransactionsForAdmin(),
      runTable("transactions", "SUPERADMIN", {}),
    ]);
    const activeMethods = methods.filter(method => method.isActive).length;
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} action={<Link className="button button--ghost" href="/superadmin/metode-pembayaran">Metode pembayaran</Link>} />
      {activeMethods === 0 && <div className="internal-warning">
        <AlertTriangle size={18} />
        <p>Belum ada metode pembayaran aktif, jadi pelanggan belum dapat membuat tagihan. Tambahkan rekening atau e-wallet di <Link href="/superadmin/metode-pembayaran">Metode pembayaran</Link>.</p>
      </div>}
      <TransactionsReview initial={transactions} />
      <TransactionsTable initial={transactionRows} searchHint={tableSearchHint("transactions")} />
    </>;
  }

  if (section === "metode-pembayaran") {
    const methods = await listPaymentMethodsForAdmin();
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} action={<Link className="button button--ghost" href="/superadmin/pembayaran">Verifikasi pembayaran</Link>} />
      <PaymentMethodsManager methods={methods} />
    </>;
  }

  if (section === "kuota") {
    const [connections, usage] = await Promise.all([runTable("connections", "SUPERADMIN", {}), platformUsageToday()]);
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <PlatformUsagePanel usage={usage} />
      <ConnectionsTable initial={connections} searchHint={tableSearchHint("connections")} />
    </>;
  }

  if (section === "kepatuhan") {
    const [stats, terms, flagged] = await Promise.all([
      listModerationStats(),
      runTable("blacklist", "SUPERADMIN", {}),
      listFlaggedReplies(),
    ]);
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <section className="stat-grid">
        <article className="stat-card"><span>Penandaan terbuka</span><strong>{stats.openFlags}</strong><p>{stats.openFlags > 0 ? "Menunggu keputusan tim moderasi" : "Antrean bersih"}</p></article>
        <article className="stat-card"><span>Penandaan selesai</span><strong>{stats.resolvedFlags}</strong><p>Keputusan tercatat di audit log</p></article>
        <article className="stat-card"><span>Istilah terlarang aktif</span><strong>{stats.activeTerms}</strong><p>Dipakai untuk menahan draft berisiko</p></article>
      </section>
      <BlacklistTable initial={terms} searchHint={tableSearchHint("blacklist")} />
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
    const [credentials, credentialRows] = await Promise.all([listCredentials(), runTable("credentials", "SUPERADMIN", {})]);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} action={<a className="button button--ghost" href="/api/admin/api-docs" download>Unduh OpenAPI</a>} />
      <CredentialsTable initial={credentialRows} searchHint={tableSearchHint("credentials")} />
      <ApiDocs baseUrl={baseUrl} credentials={credentials} />
    </>;
  }

  if (section === "kontak") {
    const submissions = await runTable("contact", "SUPERADMIN", {});
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <ContactTable initial={submissions} searchHint={tableSearchHint("contact")} />
    </>;
  }

  if (section === "audit") {
    const entries = await runTable("audit", "SUPERADMIN", {});
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <AuditTable initial={entries} searchHint={tableSearchHint("audit")} />
    </>;
  }

  if (section === "halaman-publik") {
    const [faqs, pages] = await Promise.all([listFaqsForCms(), listStaticPagesForCms()]);
    return <>
      <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
      <SiteContentManager faqs={faqs} pages={pages} />
    </>;
  }

  const [user, articles, articleRows] = await Promise.all([
    getSessionUser(),
    listArticlesForCms(),
    runTable("articles", "SUPERADMIN", {}),
  ]);
  return <>
    <PageHeading eyebrow="Superadmin" title={heading.title} copy={heading.copy} />
    <ArticlesTable initial={articleRows} searchHint={tableSearchHint("articles")} />
    <ArticlesManager role="SUPERADMIN" userId={user?.id ?? ""} articles={articles.map(serializeCmsArticle)} />
  </>;
}
