import type { WorkerStatus } from "@/server/jobs/runtime";
import { formatDateTime } from "@/lib/format";
import { ModerationActions } from "./moderation-actions";
import { WorkerControls } from "./worker-controls";


function EmptyRow({ cols, message }: { cols: string; message: string }) {
  return <div className={`data-row table-empty-row ${cols}`}><span>{message}</span></div>;
}

function TableHeading({ title, description, count }: { title: string; description: string; count?: number }) {
  return <div className="panel-heading internal-panel-heading"><div><h2>{title}</h2><p>{description}</p></div>{count !== undefined && <span className="internal-count">{count.toLocaleString("id-ID")} total</span>}</div>;
}

/**
 * `canModerate` memisahkan apa yang boleh dilakukan tiap peran: Admin menambah
 * dan melihat akun, sedangkan menangguhkan akun atau mencabut koneksi Threads
 * tetap milik Superadmin — sama seperti yang ditegakkan API-nya.
 */
export function SystemStateTable({ worker, threadsOAuthStatus }: { worker: WorkerStatus | null; threadsOAuthStatus: "valid" | "invalid" | "unavailable" | "not_configured" }) {
  const rows: Array<[string, string, string]> = [
    ["Database MySQL", process.env.DATABASE_URL ? "Terhubung (halaman ini dirender dari data)" : "Belum dikonfigurasi", process.env.DATABASE_URL ? "Aktif" : "Terbatas"],
    ["Threads OAuth", threadsOAuthStatus === "valid" ? "Threads App Secret diterima Meta" : threadsOAuthStatus === "invalid" ? "Threads App Secret ditolak Meta" : threadsOAuthStatus === "unavailable" ? "Meta belum dapat memverifikasi kredensial" : "Kredensial belum lengkap", threadsOAuthStatus === "valid" ? "Siap" : "Terbatas"],
    ["Mode integrasi", process.env.INTEGRATION_MODE === "local" ? "local: adapter simulasi tanpa koneksi eksternal" : "live: API resmi Threads", "Info"],
    ["AI Draft", process.env.AI_API_KEY ? "Provider AI eksternal terisi" : "Fallback lokal deterministik", process.env.AI_API_KEY ? "Aktif" : "Fallback"],
    ["Token Threads", "Terenkripsi AES-256-GCM; nilai rahasia tidak pernah ditampilkan", "Aktif"],
  ];
  return (
    <>
      {worker && <WorkerControls {...worker} />}
      <section className="panel table-panel">
        <TableHeading title="Status layanan" description="Kondisi komponen yang dipakai platform saat ini." />
        <div className="data-table internal-table">
          <div className="data-row data-head data-row--3"><span>Integrasi</span><span>Kondisi</span><span>Status</span></div>
          {rows.map(([name, condition, status]) => (
            <div className="data-row data-row--3" key={name}>
              <span data-label="Integrasi"><strong>{name}</strong></span>
              <span data-label="Kondisi">{condition}</span>
              <span data-label="Status">{status}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function MonitoringPanels({ snapshot, threadsReady, worker }: { snapshot: { searchRunsTotal: number; searchRunsFailed: number; replyAttempts: number; replyFailures: number; activeConnections: number }; threadsReady: boolean; worker: WorkerStatus | null }) {
  const stats: Array<[string, string, string]> = [
    ["Pencarian 24 jam", `${snapshot.searchRunsTotal}`, snapshot.searchRunsFailed > 0 ? `${snapshot.searchRunsFailed} gagal` : "Tanpa kegagalan"],
    ["Upaya balasan 24 jam", `${snapshot.replyAttempts}`, snapshot.replyFailures > 0 ? `${snapshot.replyFailures} gagal` : "Tanpa kegagalan"],
    ["Koneksi aktif", `${snapshot.activeConnections}`, threadsReady ? "Kredensial Threads terisi" : "Credential belum diisi"],
    ["Worker terjadwal", worker?.enabled ? `${worker.cycleCount} siklus` : "Nonaktif", worker?.lastCycleAt ? `Siklus terakhir ${formatDateTime(worker.lastCycleAt)}` : "Belum ada siklus tercatat"],
  ];
  return (
    <section className="stat-grid">
      {stats.map(([label, value, note]) => (
        <article className="stat-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <p>{note}</p>
        </article>
      ))}
    </section>
  );
}

export function ModerationQueue({ drafts }: { drafts: Array<Record<string, unknown>> }) {
  return (
    <section className="panel table-panel">
      <TableHeading title="Draft yang perlu ditinjau" description="Tinjau aturan yang terpicu sebelum mengambil keputusan." count={drafts.length} />
      <div className="data-table internal-table">
        <div className="data-row data-head data-row--4"><span>Draft balasan</span><span>Pengguna</span><span>Aturan yang memicu</span><span>Keputusan</span></div>
        {drafts.length === 0 && <EmptyRow cols="data-row--4" message="Tidak ada draft yang ditandai. Antrean bersih." />}
        {drafts.map(draft => {
          const author = draft.user as { name: string };
          const flags = draft.moderationFlags as Array<{ id: string; ruleCode: string; reason: string }>;
          return (
            <div className="data-row data-row--4" key={String(draft.id)}>
              <span data-label="Draft balasan"><strong>{String(draft.body).slice(0, 90)}{String(draft.body).length > 90 ? "…" : ""}</strong></span>
              <span data-label="Pengguna">{author.name}</span>
              <span data-label="Aturan yang memicu">{flags.map(flag => `${flag.ruleCode}: ${flag.reason}`).join("; ")}</span>
              <span data-label="Keputusan" className="row-actions">{flags[0] ? <ModerationActions flagId={flags[0].id} /> : "—"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
