"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AtSign, Bell, Bot, Building2, LoaderCircle, Shield, UserCheck } from "lucide-react";
import { useReplyAutomation } from "@/features/replies/lib/use-reply-automation";
import { ProfileSettings } from "@/features/settings/components/profile-settings";
import { NotificationSettings } from "@/features/settings/components/notification-settings";
import { SecuritySettings } from "@/features/settings/components/security-settings";

const tabs = [
  { id: "profil", label: "Profil bisnis", icon: Building2 },
  { id: "balasan", label: "Mode balasan", icon: Bot },
  { id: "threads", label: "Integrasi Threads", icon: AtSign },
  { id: "notifikasi", label: "Notifikasi", icon: Bell },
  { id: "keamanan", label: "Keamanan & data", icon: Shield },
];

type ThreadsState = {
  loading: boolean;
  configured: boolean;
  requiresHttps?: boolean;
  credentialsInvalid?: boolean;
  connected: boolean;
  needsReconnectForReplies?: boolean;
  tokenShortLived?: boolean;
  tokenExpiresAt?: string | null;
  searchPreviewAvailable?: boolean;
  username?: string | null;
  publishingLimit?: {
    quotaUsage: number;
    quotaLimit: number;
    replyQuotaUsage: number;
    replyQuotaLimit: number;
  } | null;
  error?: string;
};

const connectionErrors: Record<string, string> = {
  permission_denied: "Izin akses Threads tidak diberikan. Setujui izin akun saat mencoba menghubungkan kembali.",
  provider_error: "Threads menolak permintaan koneksi. Periksa izin akun dan pengaturan aplikasi Threads di Meta.",
  missing_code: "Threads tidak mengirim kode otorisasi. Mulai ulang koneksi dari halaman ini.",
  state_missing: "Sesi koneksi hilang. Buka aplikasi melalui HTTPS dan ulangi dari browser yang sama.",
  state_mismatch: "Sesi koneksi tidak cocok. Mulai ulang koneksi dari halaman ini.",
  session_expired: "Sesi Cari Market berakhir saat menghubungkan Threads. Masuk kembali lalu ulangi koneksi.",
  token_exchange: "Threads menerima proses login, tetapi penukaran token gagal. Periksa Threads App ID, App Secret, dan URL callback di Meta.",
  invalid_app_secret: "Threads App Secret pada konfigurasi Cari Market ditolak Meta. Minta administrator memperbarui Threads App Secret dari dashboard aplikasi Meta.",
  token_extend: "Token awal diterima, tetapi token jangka panjang belum berhasil dibuat. Coba lagi atau periksa pengaturan aplikasi Threads.",
  profile: "Token diterima, tetapi profil akun Threads belum dapat dibaca. Periksa izin Threads Basic lalu coba lagi.",
  account_in_use: "Akun Threads ini sudah terhubung ke workspace lain.",
  save_failed: "Koneksi berhasil diotorisasi, tetapi belum dapat disimpan. Silakan coba lagi.",
  signup_disabled: "Pendaftaran akun baru lewat Threads sedang dimatikan. Masuk terlebih dahulu, lalu hubungkan akun Threads dari halaman ini.",
};

export function SettingsPanel({ hasPassword, profileComplete }: { hasPassword: boolean; profileComplete: boolean }) {
  const [active, setActive] = useState("profil");
  const navRef = useRef<HTMLElement>(null);
  const [threads, setThreads] = useState<ThreadsState>({ loading: true, configured: false, connected: false });
  const { settings, updateSettings, saving: savingAutomation, error: automationError } = useReplyAutomation();
  const update = (patch: Partial<typeof settings>) => updateSettings({ ...settings, ...patch });

  const loadThreadsStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/threads/status", { cache: "no-store" });
      const payload = await response.json() as { data?: Omit<ThreadsState, "loading">; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Status koneksi tidak dapat dibaca.");
      setThreads({ loading: false, ...payload.data });
    } catch (error) {
      setThreads({ loading: false, configured: false, connected: false, error: error instanceof Error ? error.message : "Status koneksi tidak dapat dibaca." });
    }
  }, []);

  useEffect(() => {
    const connectionResult = new URLSearchParams(window.location.search).get("threads");
    const connectionReason = new URLSearchParams(window.location.search).get("threads_reason");
    void loadThreadsStatus().then(() => {
      if (connectionResult === "error") {
        setThreads(current => ({ ...current, error: current.credentialsInvalid ? connectionErrors.invalid_app_secret : connectionErrors[connectionReason ?? ""] ?? "Akun Threads belum berhasil dihubungkan. Silakan coba lagi." }));
      }
    });
    if (connectionResult && profileComplete) {
      const frame = window.requestAnimationFrame(() => setActive("threads"));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [loadThreadsStatus, profileComplete]);

  useEffect(() => {
    navRef.current?.querySelector("button.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  async function disconnectThreads() {
    setThreads(current => ({ ...current, loading: true, error: undefined }));
    try {
      const response = await fetch("/api/integrations/threads/disconnect", { method: "POST" });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? "Koneksi belum dapat diputuskan.");
      }
      await loadThreadsStatus();
    } catch (error) {
      setThreads(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Koneksi belum dapat diputuskan." }));
    }
  }

  const pct = (used: number, limit: number) => limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return <div className="settings-grid">
    <nav className="settings-nav" aria-label="Bagian pengaturan" ref={navRef}>
      {tabs.map(tab => { const Icon = tab.icon; return <button className={active === tab.id ? "active" : ""} aria-current={active === tab.id ? "page" : undefined} key={tab.id} onClick={() => setActive(tab.id)} disabled={!profileComplete && tab.id !== "profil"}><Icon /> <span>{tab.label}</span></button>; })}
    </nav>

    <section className={`panel settings-form settings-form--${active}`}>
      {active === "profil" && <ProfileSettings redirectAfterSave={!profileComplete} />}

      {active === "balasan" && <>
        <div className="panel-heading"><div><h2>Mode balasan</h2><p>Tentukan kapan draft boleh dikirim dan kapan harus menunggu Anda.</p></div><span className={`mode-status mode-status--${settings.mode}`}>{settings.mode === "review" ? "Tinjau dulu" : "Otomatis aktif"}</span></div>
        <div className="reply-mode-settings">
          <div className="mode-choice-grid" role="radiogroup" aria-label="Pilih mode balasan">
            <button type="button" role="radio" aria-checked={settings.mode === "review"} className={settings.mode === "review" ? "active" : ""} onClick={() => update({ mode: "review" })}><UserCheck /><span><strong>Tinjau dulu</strong><small>Setiap draft menunggu pemeriksaan dan persetujuan Anda.</small></span></button>
            <button type="button" role="radio" aria-checked={settings.mode === "auto"} className={settings.mode === "auto" ? "active" : ""} onClick={() => update({ mode: "auto" })}><Bot /><span><strong>Balas otomatis</strong><small>Draft yang lolos semua aturan dijadwalkan tanpa approval satu per satu.</small></span></button>
          </div>
          {settings.mode === "auto" && <div className="automation-rules">
            <div className="automation-warning"><Shield size={18} /><p><strong>Kontrol keamanan tetap aktif.</strong> Draft berisiko atau di bawah ambang relevansi selalu dialihkan ke tinjauan manual.</p></div>
            <div className="form-two"><div className="field"><label htmlFor="minimum-score">Relevansi minimum</label><div className="input-suffix"><input className="input" id="minimum-score" type="number" min="70" max="100" value={settings.minimumScore} onChange={event => update({ minimumScore: Number(event.target.value) })} /><span>%</span></div></div><div className="field"><label htmlFor="daily-limit">Batas balasan per hari</label><input className="input" id="daily-limit" type="number" min="1" max="50" value={settings.dailyLimit} onChange={event => update({ dailyLimit: Number(event.target.value) })} /></div></div>
            <div className="field"><label htmlFor="delay-minutes">Jeda sebelum dikirim</label><select className="input" id="delay-minutes" value={settings.delayMinutes} onChange={event => update({ delayMinutes: Number(event.target.value) })}><option value="5">5 menit</option><option value="15">15 menit</option><option value="30">30 menit</option><option value="60">1 jam</option></select></div>
            <label className="safety-toggle"><input type="checkbox" checked={settings.pauseOnRisk} onChange={event => update({ pauseOnRisk: event.target.checked })} /><span><strong>Alihkan draft berisiko ke tinjauan</strong><small>Disarankan untuk klaim sensitif, pola berulang, atau kata yang diblokir.</small></span></label>
            <label className="safety-toggle"><input type="checkbox" checked={settings.quietHoursEnabled} onChange={event => update({ quietHoursEnabled: event.target.checked, quietHoursStart: event.target.checked ? (settings.quietHoursStart ?? "22:00") : null, quietHoursEnd: event.target.checked ? (settings.quietHoursEnd ?? "07:00") : null })} /><span><strong>Jangan kirim di jam tertentu</strong><small>Penjadwalan otomatis dijeda pada rentang waktu yang Anda tentukan (Waktu Universal/UTC).</small></span></label>
            {settings.quietHoursEnabled && <div className="form-two"><div className="field"><label htmlFor="quiet-start">Jam mulai</label><input className="input" id="quiet-start" type="time" value={settings.quietHoursStart ?? ""} onChange={event => update({ quietHoursStart: event.target.value })} /></div><div className="field"><label htmlFor="quiet-end">Jam selesai</label><input className="input" id="quiet-end" type="time" value={settings.quietHoursEnd ?? ""} onChange={event => update({ quietHoursEnd: event.target.value })} /></div></div>}
          </div>}
          {automationError && <p className="form-feedback form-feedback--error" role="alert">{automationError}</p>}
          <p className="form-feedback" role="status">{savingAutomation ? "Menyimpan perubahan mode..." : automationError ? "Perubahan belum tersimpan." : "Perubahan mode disimpan otomatis."}</p>
        </div>
      </>}

      {active === "threads" && <>
        <div className="panel-heading"><div><h2>Integrasi Threads</h2><p>Kelola akun yang digunakan untuk pencarian dan pengiriman balasan.</p></div></div>
        <div className="settings-section-body settings-section-body--threads" aria-live="polite">
          {threads.loading ? <div className="integration-loading"><span className="integration-state__icon"><LoaderCircle className="spin" /></span><h3>Memeriksa koneksi</h3><p>Tunggu sebentar, kami sedang memeriksa akun Threads Anda.</p></div> : threads.connected ?
            <div className="integration-connected"><div className="integration-connected__account"><span className="integration-state__icon"><AtSign /></span><div><span className="integration-eyebrow">Akun terhubung</span><h3>{threads.username ? `@${threads.username}` : "Threads"}</h3><p>Ketersediaan pencarian dan balasan mengikuti izin yang diberikan Meta.</p></div></div><button className="button button--danger button--small" type="button" onClick={() => void disconnectThreads()}>Putuskan koneksi</button>
              {threads.needsReconnectForReplies && <div className="integration-alert" role="alert"><Shield size={17} /><span>Koneksi ini dibuat sebelum izin membaca dan mengelola balasan diminta. <a href="/api/integrations/threads/connect">Hubungkan ulang Threads</a> agar Meta meminta izin tersebut.</span></div>}
              {threads.tokenShortLived && <div className="integration-alert" role="alert"><Shield size={17} /><span>Meta belum memberikan token jangka panjang untuk koneksi ini, jadi masa berlakunya singkat{threads.tokenExpiresAt ? ` (sampai ${new Date(threads.tokenExpiresAt).toLocaleString("id-ID")})` : ""}. Sistem mencoba meningkatkannya otomatis setiap kali dipakai; bila statusnya tidak berubah, <a href="/api/integrations/threads/connect">hubungkan ulang Threads</a>.</span></div>}
              {threads.publishingLimit && <div className="integration-quota" aria-live="polite">
                <div className="integration-quota__row"><span>Kuota posting (24 jam)</span><strong>{threads.publishingLimit.quotaUsage} / {threads.publishingLimit.quotaLimit}</strong></div>
                <div className="integration-quota__bar"><span style={{ width: `${pct(threads.publishingLimit.quotaUsage, threads.publishingLimit.quotaLimit)}%` }} /></div>
                <div className="integration-quota__row"><span>Kuota balasan (24 jam)</span><strong>{threads.publishingLimit.replyQuotaUsage} / {threads.publishingLimit.replyQuotaLimit}</strong></div>
                <div className="integration-quota__bar"><span style={{ width: `${pct(threads.publishingLimit.replyQuotaUsage, threads.publishingLimit.replyQuotaLimit)}%` }} /></div>
              </div>}
              {threads.error && <div className="integration-alert" role="alert"><Shield size={17} /><span>{threads.error}</span></div>}</div> :
            <div className="integration-state"><span className="integration-state__icon"><AtSign /></span><span className="integration-eyebrow">Koneksi akun</span><h3>Threads belum terhubung</h3><p>{threads.configured ? "Hubungkan akun Threads untuk menggunakan fitur akun dan pengiriman balasan." : threads.credentialsInvalid ? "Threads App Secret pada konfigurasi Cari Market ditolak Meta. Administrator perlu memperbaruinya sebelum akun dapat dihubungkan." : threads.requiresHttps ? "Buka Cari Market melalui alamat HTTPS untuk menghubungkan akun Threads." : "Koneksi akun Threads belum tersedia. Silakan hubungi administrator workspace."}</p>{threads.configured && <a className="button button--primary" href="/api/integrations/threads/connect">Hubungkan Threads</a>}{threads.searchPreviewAvailable && <p className="integration-preview-note">Pencarian publik tersedia dalam mode pratinjau sebelum App Review selesai. Mode ini bukan koneksi akun Threads Anda; pengiriman balasan memerlukan koneksi resmi.</p>}{threads.error && <div className="integration-alert" role="alert"><Shield size={17} /><span>{threads.error}</span></div>}</div>}
        </div>
      </>}

      {active === "notifikasi" && <NotificationSettings />}
      {active === "keamanan" && <SecuritySettings initialHasPassword={hasPassword} />}
    </section>
  </div>;
}
