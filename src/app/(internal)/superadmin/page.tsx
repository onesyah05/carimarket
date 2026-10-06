import { Activity, MessagesSquare, Search, Users } from "lucide-react";
import { MetricCard, PageHeading, QuotaMeter } from "@/components/dashboard-ui";
import { getSuperadminOverview } from "@/server/admin/queries";
import { getWorkerStatus } from "@/server/jobs/runtime";
import { getThreadsOAuthReadiness } from "@/server/integrations/threads/config";

const API_SEARCH_QUOTA = 2200;
const API_REPLY_QUOTA = 2200;

function formatNumber(value: number) {
  return value.toLocaleString("id-ID");
}

export default async function SuperadminPage() {
  const [overview, worker, threadsOAuthStatus] = await Promise.all([getSuperadminOverview(), Promise.resolve(getWorkerStatus()), getThreadsOAuthReadiness()]);
  const threadsReady = threadsOAuthStatus === "valid";
  const maxRuns = Math.max(...overview.runsByDay.map(bucket => bucket.count), 1);
  const totalRuns = overview.runsByDay.reduce((sum, bucket) => sum + bucket.count, 0);
  const searchQuotaPct = Math.round((overview.searches24h / API_SEARCH_QUOTA) * 100);

  const yLabels = [maxRuns, Math.round(maxRuns * 0.75), Math.round(maxRuns * 0.5), Math.round(maxRuns * 0.25), 0];

  return <>
    <PageHeading eyebrow="Kontrol platform" title="Dashboard Superadmin" copy="Kesehatan platform, penggunaan, dan kepatuhan dalam satu tampilan." />
    <section className="metric-grid metric-grid--four">
      <MetricCard label="Pengguna aktif" value={formatNumber(overview.usersActive)} change={overview.suspendedUsers > 0 ? `${overview.suspendedUsers} akun ditangguhkan` : "Semua akun aktif"} icon={<Users size={19} />} />
      <MetricCard label="Pencarian" value={formatNumber(overview.searchesMonth)} change="Bulan berjalan" icon={<Search size={19} />} />
      <MetricCard label="Balasan" value={formatNumber(overview.repliesMonth)} change="Bulan berjalan" icon={<MessagesSquare size={19} />} />
      <MetricCard label="Worker" value={worker.enabled ? "Aktif" : "Nonaktif"} change={worker.enabled ? `${worker.cycleCount} siklus tercatat` : "Jalankan dari menu Sistem"} icon={<Activity size={19} />} />
    </section>
    <section className="dashboard-grid">
      <div className="panel activity-panel" style={{ marginTop: 0 }}>
        <div className="panel-heading"><div><h2>Pertumbuhan penggunaan</h2><p>Pencarian per hari, 12 hari terakhir.</p></div></div>
        <div className="chart">
          <div className="chart-y">{yLabels.map((value, index) => <span key={index}>{formatNumber(value)}</span>)}</div>
          <div className="bars">{overview.runsByDay.map((bucket, index) => <i key={bucket.label + index} style={{ height: `${Math.round((bucket.count / maxRuns) * 100)}%` }} className={index >= overview.runsByDay.length - 2 && bucket.count > 0 ? "highlight" : ""} title={`${bucket.label}: ${bucket.count} pencarian`} />)}</div>
        </div>
        <p className="billing-note">{totalRuns > 0 ? `Data nyata · ${formatNumber(totalRuns)} pencarian dalam 12 hari terakhir.` : "Belum ada pencarian tercatat dalam 12 hari terakhir."}</p>
      </div>
      <aside className="panel quota-panel">
        <div className="panel-heading"><div><h2>Kuota Threads API</h2><p>Jendela berjalan 24 jam</p></div></div>
        <QuotaMeter label="Keyword search" used={overview.searches24h} total={API_SEARCH_QUOTA} />
        <QuotaMeter label="Reply publish" used={overview.replies24h} total={API_REPLY_QUOTA} color="yellow" />
        <p className="billing-note">{threadsReady ? (searchQuotaPct >= 80 ? "Pemakaian mendekati batas jendela 24 jam." : `Kapasitas aman. ${overview.connectionsActive} koneksi terhubung, ${overview.openFlags} penandaan moderasi terbuka.`) : threadsOAuthStatus === "invalid" ? "Threads App Secret ditolak Meta. Perbarui dari menu Integrasi Threads." : "Koneksi resmi Threads belum siap. Periksa menu Integrasi Threads."}</p>
      </aside>
    </section>
  </>;
}
