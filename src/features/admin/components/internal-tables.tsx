import type { WorkerStatus } from "@/server/jobs/runtime";
import { statusLabel, formatDateTime } from "@/lib/format";
import { UserRowActions } from "./user-row-actions";
import { ModerationActions } from "./moderation-actions";
import { WorkerControls } from "./worker-controls";

type SharedProps = { className?: string };

function EmptyRow({ cols, message }: { cols: string; message: string }) {
  return <div className={`data-row table-empty-row ${cols}`}><span>{message}</span></div>;
}

function TableHeading({ title, description, count }: { title: string; description: string; count?: number }) {
  return <div className="panel-heading internal-panel-heading"><div><h2>{title}</h2><p>{description}</p></div>{count !== undefined && <span className="internal-count">{count.toLocaleString("id-ID")} total</span>}</div>;
}

export function UsersTable({ users }: { users: Array<Record<string, unknown>> & SharedProps }) {
  return (
    <section className="panel table-panel">
      <TableHeading title="Daftar pengguna" description="Akun, bisnis, paket, dan tindakan akun." count={users.length} />
      <div className="data-table internal-table">
        <div className="data-row data-head data-row--users"><span>Pengguna</span><span>Bisnis</span><span>Role</span><span>Status</span><span>Paket</span><span>Aksi</span></div>
        {users.length === 0 && <EmptyRow cols="" message="Belum ada pengguna terdaftar." />}
        {users.map(user => {
          const plan = (user.subscriptions as Array<{ plan: { name: string } }>)[0]?.plan.name ?? "—";
          return (
            <div className="data-row data-row--users" key={String(user.id)}>
              <span data-label="Pengguna"><strong>{String(user.name)}</strong><br /><small>{user.emailIsPlaceholder ? "Email placeholder (pendaftaran Threads)" : String(user.email)}</small>{!user.emailIsPlaceholder && user.emailVerifiedAt === null ? <><br /><small>Email belum terverifikasi</small></> : null}</span>
              <span data-label="Bisnis">{user.businessProfile ? String((user.businessProfile as { name: string }).name) : "—"}</span>
              <span data-label="Role">{statusLabel(String(user.role))}</span>
              <span data-label="Status">{statusLabel(String(user.status))}</span>
              <span data-label="Paket">{plan}</span>
              <span data-label="Aksi">
                {user.role === "SUPERADMIN" ? <small>Akun tertinggi</small> : (
                  <UserRowActions userId={String(user.id)} name={String(user.name)} status={user.status as "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION"} />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AuditTable({ entries }: { entries: Array<Record<string, unknown>> }) {
  return (
    <section className="panel table-panel">
      <TableHeading title="Aktivitas platform" description="Perubahan penting yang tercatat secara otomatis." count={entries.length} />
      <div className="data-table internal-table">
        <div className="data-row data-head data-row--4"><span>Aksi</span><span>Aktor</span><span>Target</span><span>Waktu</span></div>
        {entries.length === 0 && <EmptyRow cols="data-row--4" message="Belum ada aktivitas tercatat." />}
        {entries.map(entry => (
          <div className="data-row data-row--4" key={String(entry.id)}>
            <span data-label="Aksi"><strong>{String(entry.action)}</strong></span>
            <span data-label="Aktor">{entry.actor ? String((entry.actor as { name: string }).name) : "Sistem"}</span>
            <span data-label="Target">{`${String(entry.entityType)}${entry.entityId ? ` · ${String(entry.entityId).slice(0, 14)}…` : ""}`}</span>
            <span data-label="Waktu">{formatDateTime(entry.createdAt as string)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ConnectionsTable({ connections }: { connections: Array<Record<string, unknown>> }) {
  return (
    <section className="panel table-panel">
      <TableHeading title="Koneksi pengguna" description="Status akun Threads dan pemakaian fitur." count={connections.length} />
      <div className="data-table internal-table">
        <div className="data-row data-head data-row--5"><span>Pengguna</span><span>Akun Threads</span><span>Status</span><span>Capability</span><span>Pemakaian (cari/balas)</span></div>
        {connections.length === 0 && <EmptyRow cols="data-row--5" message="Belum ada koneksi Threads yang dibuat. Status token tidak pernah ditampilkan di panel ini." />}
        {connections.map(connection => {
          const user = connection.user as { name: string; email: string };
          const expires = connection.tokenExpiresAt ? formatDateTime(String(connection.tokenExpiresAt)) : "—";
          return (
            <div className="data-row data-row--5" key={String(connection.id)}>
              <span data-label="Pengguna"><strong>{user.name}</strong><br /><small>{user.email}</small></span>
              <span data-label="Akun Threads">{connection.username ? `@${String(connection.username)}` : "—"}</span>
              <span data-label="Status">{statusLabel(String(connection.status))}{connection.tokenExpiresAt !== null && connection.status === "CONNECTED" ? <><br /><small>Token s.d. {expires}</small></> : null}</span>
              <span data-label="Capability">{statusLabel(String(connection.capability))}{connection.tokenKind === "SHORT_LIVED" ? <><br /><small>Token jangka pendek</small></> : null}{connection.lastErrorCode ? <><br /><small>Kegagalan terakhir: {String(connection.lastErrorCode)}</small></> : null}</span>
              <span data-label="Pemakaian cari / balas">{`${connection.searchCount ?? 0} / ${connection.replyCount ?? 0}`}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

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

export function TicketsTable({ tickets }: { tickets: Array<Record<string, unknown>> }) {
  return (
    <section className="panel table-panel">
      <TableHeading title="Tiket dukungan" description="Permintaan bantuan dari pengguna." count={tickets.length} />
      <div className="data-table internal-table">
        <div className="data-row data-head data-row--5"><span>Subjek</span><span>Pengguna</span><span>Status</span><span>Prioritas</span><span>Diperbarui</span></div>
        {tickets.length === 0 && <EmptyRow cols="data-row--5" message="Belum ada tiket dukungan. Tiket dari pengguna akan muncul di sini." />}
        {tickets.map(ticket => {
          const requester = ticket.requester as { name: string };
          const assignee = ticket.assignee as { name: string } | null;
          return (
            <div className="data-row data-row--5" key={String(ticket.id)}>
              <span data-label="Subjek"><strong>{String(ticket.subject)}</strong></span>
              <span data-label="Pengguna">{requester.name}{assignee ? <><br /><small>Ditangani {assignee.name}</small></> : null}</span>
              <span data-label="Status">{statusLabel(String(ticket.status))}</span>
              <span data-label="Prioritas">{statusLabel(String(ticket.priority))}</span>
              <span data-label="Diperbarui">{formatDateTime(ticket.updatedAt as string)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ContactSubmissionsTable({ submissions }: { submissions: Array<Record<string, unknown>> }) {
  return (
    <section className="panel table-panel">
      <TableHeading title="Pesan dari formulir kontak" description="Permintaan dari calon pengguna yang belum memiliki akun." count={submissions.length} />
      <div className="data-table internal-table">
        <div className="data-row data-head data-row--4"><span>Pengirim</span><span>Bisnis</span><span>Pesan</span><span>Masuk</span></div>
        {submissions.length === 0 && <EmptyRow cols="data-row--4" message="Belum ada pesan kontak yang masuk." />}
        {submissions.map(submission => (
          <div className="data-row data-row--4" key={String(submission.id)}>
            <span data-label="Pengirim"><strong>{String(submission.name)}</strong><br /><small>{String(submission.email)}</small></span>
            <span data-label="Bisnis">{submission.company ? String(submission.company) : "—"}</span>
            <span data-label="Pesan">{String(submission.message).slice(0, 140)}{String(submission.message).length > 140 ? "…" : ""}</span>
            <span data-label="Masuk">{formatDateTime(submission.createdAt as string)}</span>
          </div>
        ))}
      </div>
    </section>
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
