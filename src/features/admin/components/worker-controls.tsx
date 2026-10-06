"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

export function WorkerControls({ enabled, running, cycleCount, lastCycleAt, lastDurationMs, lastError }: {
  enabled: boolean;
  running: boolean;
  cycleCount: number;
  lastCycleAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function triggerCycle() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/jobs", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Siklus belum berhasil dijalankan.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel mini-form-panel">
      <div className="worker-head">
        <div>
          <strong>Pekerja latar (worker)</strong>
          <p>
            {enabled
              ? `Aktif · ${cycleCount} siklus · terakhir ${lastCycleAt ? new Date(lastCycleAt).toLocaleTimeString("id-ID") : "belum ada"}${lastDurationMs !== null ? ` · ${lastDurationMs} ms` : ""}`
              : "Nonaktif di proses ini (WORKER_ENABLED=false atau database belum dikonfigurasi)."}
            {running ? " · sedang berjalan" : ""}
          </p>
          {lastError && <p className="row-error">Siklus terakhir gagal: {lastError}</p>}
        </div>
        <button className="button button--primary button--small" type="button" onClick={() => void triggerCycle()} disabled={pending}>
          <Play size={14} /> {pending ? "Menjalankan…" : "Jalankan siklus"}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
