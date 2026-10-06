"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AtSign, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { OnboardingShell } from "@/components/onboarding-shell";

type ThreadsStatus = { configured: boolean; requiresHttps?: boolean; credentialsInvalid?: boolean; connected: boolean; searchPreviewAvailable?: boolean; username?: string | null };

export function ThreadsOnboardingStep() {
  const [status, setStatus] = useState<ThreadsStatus | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/integrations/threads/status", { cache: "no-store" })
      .then(async response => response.ok ? (await response.json() as { data?: ThreadsStatus }).data ?? null : null)
      .then(next => { if (active) setStatus(next); })
      .catch(() => { if (active) setStatus(null); });
    return () => { active = false; };
  }, []);

  const connected = status?.connected === true;
  return <OnboardingShell step={2} title="Hubungkan akun Threads." copy="Hubungkan akun agar Cari Market dapat mengirim balasan melalui integrasi resmi Threads.">
    <div className="connect-card">
      <span className="connect-icon"><AtSign /></span>
      <div>
        <h2>Threads</h2>
        {status === null
          ? <p>Memeriksa status koneksi…</p>
          : connected
            ? <p>Terhubung{status.username ? ` sebagai @${status.username}` : ""}</p>
            : <p>Belum terhubung</p>}
      </div>
      {status === null
        ? <span className="connect-spinner" aria-hidden="true"><LoaderCircle className="spin" /></span>
        : connected
          ? <span className="connect-done"><CheckCircle2 size={18} /> Siap</span>
          : status.configured ? <a className="button button--dark" href="/api/integrations/threads/connect">Hubungkan Threads</a> : null}
    </div>
    {connected && <div className="security-note"><ShieldCheck size={18} /><p>Kredensial akun hanya diproses melalui alur otorisasi resmi Threads. Pencarian publik bergantung pada status App Review.</p></div>}
    {!connected && status?.searchPreviewAvailable && <div className="security-note"><ShieldCheck size={18} /><p>Pencarian publik tersedia dalam mode pratinjau sebelum App Review selesai. Akun Anda tetap belum terhubung dan balasan belum dapat dikirim melalui akun Anda.</p></div>}
    {!connected && status && !status.configured && <div className="security-note"><ShieldCheck size={18} /><p>{status.credentialsInvalid ? "Konfigurasi Threads ditolak Meta. Administrator perlu memperbarui Threads App Secret sebelum akun dapat dihubungkan." : status.requiresHttps ? "Buka Cari Market melalui alamat HTTPS untuk menghubungkan akun Threads." : "Koneksi akun Threads belum tersedia. Anda dapat melanjutkan pengaturan dan menghubungkannya setelah administrator mengaktifkan integrasi resmi."}</p></div>}
    <Link className="text-link" href="/onboarding/kata-kunci">{connected ? "Lanjutkan" : "Lewati untuk sekarang"}</Link>
  </OnboardingShell>;
}
