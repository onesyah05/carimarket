import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { PageHeading } from "@/components/dashboard-ui";
import { getWorkspaceUser } from "@/server/workspace-user";
import { listReplyHistory, replyHistoryLabel, replyHistoryTone } from "@/server/replies/queries";

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default async function HistoryPage() {
  const user = await getWorkspaceUser();
  const history = await listReplyHistory(user.id);

  return <>
    <PageHeading eyebrow="Aktivitas balasan" title="Riwayat balasan" copy="Pantau status draft, jadwal, dan pengiriman balasan." />
    <section className="panel table-panel">
      <div className="data-table history-table">
        <div className="data-row data-head"><span>Penerima</span><span>Topik</span><span>Waktu</span><span>Status</span></div>
        {history.map(entry => {
          const tone = replyHistoryTone(entry.status);
          const label = replyHistoryLabel(entry.status);
          return <div className="data-row" key={entry.id}>
            <strong data-label="Penerima">{entry.recipient}</strong>
            <span data-label="Topik">{entry.topic || "Threads"}</span>
            <span data-label="Waktu">{formatTimestamp(entry.occurredAt)}</span>
            <span data-label="Status" className={`history-status ${tone}`} title={entry.errorCode ?? undefined}>
              {tone === "failed" ? <XCircle size={15} /> : tone === "scheduled" ? <Clock3 size={15} /> : <CheckCircle2 size={15} />}
              {label}
            </span>
          </div>;
        })}
        {history.length === 0 && <div className="data-row table-empty-row"><span>Belum ada aktivitas balasan. Draft dan pengiriman akan muncul di sini.</span></div>}
      </div>
    </section>
  </>;
}
