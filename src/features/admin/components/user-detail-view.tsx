import Link from "next/link";
import { ArrowLeft, AtSign, CreditCard, Gauge, Receipt, Settings2, ShieldCheck, Smartphone, Tags } from "lucide-react";
import { formatDateTime, formatRupiah, statusLabel } from "@/lib/format";
import type { UserDetail } from "@/server/admin/user-detail";

/**
 * Detail satu akun pelanggan.
 *
 * Komponen server: seluruh isinya data yang sudah jadi, tidak ada yang perlu
 * bereaksi terhadap pengguna. Tindakan akun (tangguhkan, reset koneksi, pindah
 * kategori) diteruskan lewat `actions` dari halaman pemanggil, sehingga konsol
 * Admin dapat menampilkan detail yang sama tanpa tombol yang tidak boleh ia
 * pakai.
 */

type Props = {
  detail: UserDetail;
  /** Rute kembali ke daftar pengguna di konsol yang bersangkutan. */
  backHref: string;
  actions?: React.ReactNode;
};

const STATUS_TONE: Record<string, string> = { ACTIVE: "ok", SUSPENDED: "risk", PENDING_VERIFICATION: "warn" };
const CONNECTION_TONE: Record<string, string> = { CONNECTED: "ok", PENDING: "warn", EXPIRED: "warn", REVOKED: "risk", ERROR: "risk" };

function initials(name: string) {
  return name.split(" ").map(part => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function QuotaRow({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {limit === null
          ? `${used.toLocaleString("id-ID")} (tanpa batas)`
          : `${used.toLocaleString("id-ID")} / ${limit.toLocaleString("id-ID")}`}
      </dd>
    </div>
  );
}

export function UserDetailView({ detail, backHref, actions }: Props) {
  const { account, totals, quota } = detail;

  return (
    <>
      <Link className="detail-back" href={backHref}>
        <ArrowLeft size={15} aria-hidden="true" /> Kembali ke daftar pengguna
      </Link>

      <header className="detail-header">
        <span className="detail-avatar" aria-hidden="true">{initials(account.name)}</span>
        <span className="detail-identity">
          <strong>{account.name}</strong>
          <span>
            {account.emailIsPlaceholder
              ? "Email placeholder — akun dibuat lewat Threads dan tidak dapat dihubungi"
              : account.email}
          </span>
        </span>
        <span className="detail-badges">
          <span className={`dt-badge dt-badge--${STATUS_TONE[account.status] ?? "warn"}`}>{statusLabel(account.status)}</span>
          <span className="dt-badge">{statusLabel(account.role)}</span>
          {quota?.planName && <span className="dt-badge dt-badge--brand">{quota.planName}</span>}
        </span>
      </header>

      {actions && <section className="panel">{actions}</section>}

      <section className="metric-grid metric-grid--four">
        <div className="metric-card">
          <span>Lead ditemukan</span>
          <strong>{totals.leads.toLocaleString("id-ID")}</strong>
          <small>{totals.searchRuns.toLocaleString("id-ID")} pencarian dijalankan</small>
        </div>
        <div className="metric-card">
          <span>Balasan terkirim</span>
          <strong>{totals.sentReplies.toLocaleString("id-ID")}</strong>
          <small>dari {totals.drafts.toLocaleString("id-ID")} draft</small>
        </div>
        <div className="metric-card">
          <span>Kata kunci</span>
          <strong>{totals.keywords.toLocaleString("id-ID")}</strong>
          <small>pada {totals.profiles} jasa</small>
        </div>
        <div className="metric-card">
          <span>Tiket dukungan</span>
          <strong>{totals.tickets.toLocaleString("id-ID")}</strong>
          <small>sejak akun dibuat</small>
        </div>
      </section>

      <div className="detail-grid">
        <article className="detail-card">
          <h3><ShieldCheck size={13} aria-hidden="true" /> Akun</h3>
          <dl className="detail-list">
            <div><dt>Terdaftar</dt><dd>{formatDateTime(account.createdAt)}</dd></div>
            <div><dt>Masuk terakhir</dt><dd>{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Belum pernah"}</dd></div>
            <div><dt>Email</dt><dd>{account.emailIsPlaceholder ? "Placeholder" : account.emailVerified ? "Terverifikasi" : "Belum terverifikasi"}</dd></div>
            <div><dt>Kata sandi</dt><dd>{account.hasPassword ? "Tersetel" : "Belum ada — masuk lewat Threads"}</dd></div>
            {account.suspendedAt && <div><dt>Ditangguhkan</dt><dd>{formatDateTime(account.suspendedAt)}</dd></div>}
          </dl>
        </article>

        {quota && (
          <article className="detail-card">
            <h3><Gauge size={13} aria-hidden="true" /> Kuota bulan berjalan</h3>
            <dl className="detail-list">
              <div><dt>Paket</dt><dd>{quota.planName ?? "Tanpa paket"}{quota.planSource === "default" ? " (bawaan)" : ""}</dd></div>
              <QuotaRow label="Pencarian" used={quota.search.used} limit={quota.search.limit} />
              <QuotaRow label="Balasan" used={quota.reply.used} limit={quota.reply.limit} />
              <QuotaRow label="Kata kunci" used={quota.keywords.used} limit={quota.keywords.limit} />
            </dl>
          </article>
        )}

        {detail.automation && (
          <article className="detail-card">
            <h3><Settings2 size={13} aria-hidden="true" /> Mode balasan</h3>
            <dl className="detail-list">
              <div><dt>Mode</dt><dd>{statusLabel(detail.automation.mode)}</dd></div>
              <div><dt>Ambang skor</dt><dd>{detail.automation.minimumScore}</dd></div>
              <div><dt>Batas harian</dt><dd>{detail.automation.dailyLimit} balasan</dd></div>
              <div><dt>Jeda kirim</dt><dd>{detail.automation.delayMinutes} menit</dd></div>
              <div><dt>Jam tenang</dt><dd>{detail.automation.quietHoursEnabled && detail.automation.quietHoursStart ? `${detail.automation.quietHoursStart}–${detail.automation.quietHoursEnd}` : "Nonaktif"}</dd></div>
            </dl>
          </article>
        )}
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Profil bisnis</h2><p>Setiap jasa punya kata kunci dan lead-nya sendiri.</p></div>
          <span className="dt-badge">{detail.profiles.length} jasa</span>
        </div>
        {detail.profiles.length === 0
          ? <p className="dt__muted">Profil bisnis belum diisi, jadi pencarian belum dapat berjalan untuk akun ini.</p>
          : <div className="detail-grid" style={{ marginBottom: 0 }}>
            {detail.profiles.map(profile => (
              <article className="detail-card" key={profile.id}>
                <h3><Tags size={13} aria-hidden="true" /> {profile.name}</h3>
                <dl className="detail-list">
                  <div><dt>Kategori</dt><dd>{profile.category || "—"}</dd></div>
                  <div><dt>Lokasi</dt><dd>{profile.location || "—"}</dd></div>
                  <div><dt>Area</dt><dd>{profile.serviceArea || "—"}</dd></div>
                  <div><dt>Kata kunci</dt><dd>{profile.keywordCount.toLocaleString("id-ID")}</dd></div>
                  <div><dt>Lead</dt><dd>{profile.leadCount.toLocaleString("id-ID")}</dd></div>
                </dl>
              </article>
            ))}
          </div>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Koneksi Threads</h2><p>Status token saja; nilainya tidak pernah ditampilkan di panel ini.</p></div>
        </div>
        {detail.connections.length === 0
          ? <p className="dt__muted">Belum ada akun Threads yang tersambung.</p>
          : <dl className="detail-list">
            {detail.connections.map(connection => (
              <div key={connection.id}>
                <dt><AtSign size={13} aria-hidden="true" /> {connection.username ? `@${connection.username}` : "Tanpa username"}</dt>
                <dd>
                  <span className={`dt-badge dt-badge--${CONNECTION_TONE[connection.status] ?? "warn"}`}>{statusLabel(connection.status)}</span>
                  {" "}{statusLabel(connection.tokenKind)}
                  {connection.tokenExpiresAt ? ` · berlaku s.d. ${formatDateTime(connection.tokenExpiresAt)}` : ""}
                  {connection.lastErrorCode ? ` · ${connection.lastErrorCode}` : ""}
                </dd>
              </div>
            ))}
          </dl>}
      </section>

      <div className="detail-grid">
        <article className="detail-card">
          <h3><CreditCard size={13} aria-hidden="true" /> Langganan</h3>
          {detail.subscriptions.length === 0
            ? <p className="dt__muted">Belum pernah berlangganan.</p>
            : <dl className="detail-list">
              {detail.subscriptions.map(subscription => (
                <div key={subscription.id}>
                  <dt>{subscription.planName}</dt>
                  <dd>
                    {statusLabel(subscription.status)}
                    {subscription.currentPeriodEnd ? ` · s.d. ${formatDateTime(subscription.currentPeriodEnd)}` : ""}
                  </dd>
                </div>
              ))}
            </dl>}
        </article>

        <article className="detail-card">
          <h3><Receipt size={13} aria-hidden="true" /> Transaksi terakhir</h3>
          {detail.transactions.length === 0
            ? <p className="dt__muted">Belum ada transaksi.</p>
            : <dl className="detail-list">
              {detail.transactions.map(transaction => (
                <div key={transaction.id}>
                  <dt>{transaction.invoiceNumber}</dt>
                  <dd>
                    {formatRupiah(transaction.totalAmount)} · {transaction.planName} · {statusLabel(transaction.status)}
                  </dd>
                </div>
              ))}
            </dl>}
        </article>

        <article className="detail-card">
          <h3><Smartphone size={13} aria-hidden="true" /> Perangkat aktif</h3>
          {detail.devices.length === 0
            ? <p className="dt__muted">Tidak ada token aplikasi mobile yang aktif.</p>
            : <dl className="detail-list">
              {detail.devices.map(device => (
                <div key={device.id}>
                  <dt>{device.keyPrefix}…</dt>
                  <dd>
                    {device.name} · {statusLabel(device.source)}
                    {device.lastUsedAt ? ` · dipakai ${formatDateTime(device.lastUsedAt)}` : " · belum pernah dipakai"}
                  </dd>
                </div>
              ))}
            </dl>}
        </article>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Jejak audit</h2><p>Aktivitas terakhir yang menyangkut akun ini, dari aktor mana pun.</p></div>
        </div>
        {detail.audit.length === 0
          ? <p className="dt__muted">Belum ada catatan audit untuk akun ini.</p>
          : <ol className="detail-timeline">
            {detail.audit.map(entry => (
              <li key={entry.id}>
                <strong>{statusLabel(entry.action)}</strong>
                <span>{entry.actorName} · {entry.entityType} · {formatDateTime(entry.createdAt)}</span>
              </li>
            ))}
          </ol>}
      </section>
    </>
  );
}
