import Link from "next/link";
import { AlertTriangle, Activity, Clock3, MessageSquareWarning } from "lucide-react";
import { MetricCard, PageHeading } from "@/components/dashboard-ui";
import { getAdminOverview } from "@/server/admin/queries";
import { getWorkerStatus } from "@/server/jobs/runtime";

export default async function AdminPage() {
  const [overview, worker] = await Promise.all([getAdminOverview(), Promise.resolve(getWorkerStatus())]);

  return <>
    <PageHeading eyebrow="Operasional" title="Dashboard Admin" copy="Antrian dukungan, moderasi, dan kesehatan integrasi hari ini." />
    <section className="metric-grid">
      <MetricCard label="Tiket terbuka" value={String(overview.openTickets)} change={overview.urgentTickets > 0 ? `${overview.urgentTickets} prioritas tinggi` : "Tanpa prioritas tinggi"} icon={<Clock3 size={19} />} />
      <MetricCard label="Perlu moderasi" value={String(overview.openFlags)} change={overview.openFlags > 0 ? "Draft ditahan aturan kepatuhan" : "Antrean moderasi bersih"} icon={<MessageSquareWarning size={19} />} />
      <MetricCard label="Worker terjadwal" value={worker.enabled ? "Aktif" : "Nonaktif"} change={worker.enabled ? `${worker.cycleCount} siklus tercatat` : "Menunggu Superadmin mengaktifkan"} icon={<Activity size={19} />} />
    </section>
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>Antrian prioritas</h2><p>Item nyata yang membutuhkan tindakan operasional.</p></div></div>
      <div className="data-table internal-table">
        <div className="data-row data-head data-row--5"><span>Item</span><span>Pengguna</span><span>Kategori</span><span>Usia</span><span>Status</span></div>
        {overview.queue.length === 0 && <div className="data-row data-row--5"><span>Tidak ada item yang membutuhkan tindakan saat ini.</span></div>}
        {overview.queue.map(item => (
          <div className="data-row data-row--5" key={item.id}>
            <span><Link className="table-link" href={item.href}>{item.label}</Link></span>
            <span>{item.user}</span>
            <span>{item.category}</span>
            <span>{item.age}</span>
            <span>{item.status}</span>
          </div>
        ))}
      </div>
    </section>
    <div className="internal-warning"><AlertTriangle size={18} /><p>Admin hanya dapat meninjau dan membantu operasional. Billing, suspend permanen, credential, dan publish konten tetap dibatasi untuk Superadmin.</p></div>
  </>;
}
