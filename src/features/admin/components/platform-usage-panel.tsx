import { Gauge, ShieldAlert } from "lucide-react";
import { META_DAILY_REPLY_LIMIT, META_DAILY_SEARCH_LIMIT } from "@/server/usage/platform-limits";

type Bucket = { used: number; limit: number };

/**
 * Pemakaian tingkat platform hari ini.
 *
 * Batas Meta berlaku per akun Threads yang terhubung, dan pada jalur
 * pra-App-Review seluruh pencarian pelanggan memakai satu sesi yang sama.
 * Angka ini karena itu bukan statistik: inilah yang menentukan apakah
 * pencarian masih berjalan untuk semua orang sore ini.
 */
export function PlatformUsagePanel({ usage }: { usage: { day: string; search: Bucket; reply: Bucket } }) {
  const rows: Array<{ label: string; bucket: Bucket; metaLimit: number; note: string }> = [
    {
      label: "Pencarian kata kunci",
      bucket: usage.search,
      metaLimit: META_DAILY_SEARCH_LIMIT,
      note: "Pencarian terjadwal maupun manual dari seluruh pelanggan.",
    },
    {
      label: "Balasan terkirim",
      bucket: usage.reply,
      metaLimit: META_DAILY_REPLY_LIMIT,
      note: "Balasan yang benar-benar sampai ke Threads, termasuk dari pekerja latar.",
    },
  ];

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Pemakaian platform hari ini</h2>
          <p>Hitungan bersama untuk {usage.day} (UTC), direset setiap awal hari UTC.</p>
        </div>
        <Gauge size={20} aria-hidden="true" />
      </header>

      <div className="platform-usage-grid">
        {rows.map(row => {
          const percentage = row.bucket.limit > 0
            ? Math.min(100, Math.round((row.bucket.used / row.bucket.limit) * 100))
            : 0;
          const near = percentage >= 80;
          return (
            <article className="platform-usage-card" key={row.label}>
              <p className="platform-usage-label">{row.label}</p>
              <p className="platform-usage-value">
                <strong>{row.bucket.used.toLocaleString("id-ID")}</strong>
                <span> / {row.bucket.limit.toLocaleString("id-ID")}</span>
              </p>
              <div className="platform-usage-bar" role="img" aria-label={`${percentage} persen dari batas platform terpakai`}>
                <span className={near ? "is-near" : ""} style={{ width: `${percentage}%` }} />
              </div>
              <p className="platform-usage-note">
                {row.note} Batas Meta {row.metaLimit.toLocaleString("id-ID")} per 24 jam; batas platform ditaruh di bawahnya
                sebagai cadangan.
              </p>
              {near && (
                <p className="platform-usage-warning">
                  <ShieldAlert size={14} /> Sudah {percentage}% terpakai. Permintaan baru akan ditolak dengan pesan batas
                  platform, bukan mengurangi kuota paket pelanggan.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
