"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

type CredentialStatus = {
  configured: boolean;
  note: string | null;
  lastCheckedAt: string | null;
  updatedAt: string | null;
};

/**
 * Panel untuk Superadmin mengisi kredensial Threads tidak resmi (cookie sesi
 * web). Memungkinkan pencarian berjalan sebelum Meta menyetujui App Review.
 *
 * Nilai cookie tidak pernah ditampilkan kembali setelah disimpan; bidang input
 * selalu kosong saat halaman dibuka.
 */
export function ThreadsCredentialsManager({ status }: { status: CredentialStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState<null | "save" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [probeCount, setProbeCount] = useState<number | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending("save");
    setError(null);
    setProbeCount(null);
    try {
      const response = await fetch("/api/admin/threads-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie: data.get("cookie"),
          lsd: data.get("lsd"),
          csrf: data.get("csrf"),
          note: String(data.get("note") ?? "").trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Kredensial belum tersimpan.");
        return;
      }
      form.reset();
      setProbeCount(payload?.data?.probeCount ?? null);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    setPending("delete");
    setError(null);
    setProbeCount(null);
    try {
      const response = await fetch("/api/admin/threads-credentials", { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Kredensial belum terhapus.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <section className="panel mini-form-panel">
        <strong>Kredensial Threads (mode pra-App-Review)</strong>
        <p>
          Pencarian Threads dapat berjalan sebelum Meta menyetujui App Review dengan memakai sesi web Threads.
          Isi cookie sesi dari browser yang sudah masuk Threads. Nilai disimpan terenkripsi dan tidak pernah
          ditampilkan kembali. Hanya Superadmin yang dapat mengisi.
        </p>
        <div className="status-row">
          <span>Status:</span>
          <strong className={status.configured ? "status-ok" : "status-warn"}>
            {status.configured ? "Sudah dikonfigurasi" : "Belum dikonfigurasi"}
          </strong>
        </div>
        {status.note && <div className="status-row"><span>Catatan:</span><span>{status.note}</span></div>}
        {status.updatedAt && (
          <div className="status-row"><span>Diperbarui:</span><span>{formatDateTime(status.updatedAt)}</span></div>
        )}
        {probeCount !== null && (
          <div className="status-row"><span>Hasil uji pencarian:</span><span>{probeCount} post ditemukan</span></div>
        )}

        <form className="mini-form mini-form--stacked" onSubmit={save}>
          <label className="field-label" htmlFor="threads-cookie">Cookie sesi Threads</label>
          <textarea
            className="input input--textarea"
            id="threads-cookie"
            name="cookie"
            placeholder="sessionid=...; csrftoken=...; ds_user_id=...; ig_did=...; mid=..."
            required
            minLength={20}
            rows={3}
            spellCheck={false}
            autoComplete="off"
          />
          <label className="field-label" htmlFor="threads-lsd">Token lsd (x-fb-lsd)</label>
          <input
            className="input"
            id="threads-lsd"
            name="lsd"
            placeholder="Mis. KBSzAYNLbg-aESJzrrdG06"
            required
            minLength={8}
            spellCheck={false}
            autoComplete="off"
          />
          <label className="field-label" htmlFor="threads-csrf">csrftoken</label>
          <input
            className="input"
            id="threads-csrf"
            name="csrf"
            placeholder="Nilai cookie csrftoken"
            required
            minLength={8}
            spellCheck={false}
            autoComplete="off"
          />
          <label className="field-label" htmlFor="threads-note">Catatan (opsional)</label>
          <input className="input" id="threads-note" name="note" placeholder="Mis. Akun marketing@carimarket.id" maxLength={255} />
          <button className="button button--primary button--small" type="submit" disabled={pending !== null}>
            {pending === "save" ? "Menyimpan & menguji…" : "Simpan dan uji pencarian"}
          </button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>

      {status.configured && (
        <section className="panel mini-form-panel">
          <strong>Hapus kredensial</strong>
          <p>Menghapus akan mematikan pencarian Threads hingga kredensial diisi ulang atau App Review disetujui.</p>
          <button className="button button--small button--danger" type="button" disabled={pending !== null} onClick={() => void remove()}>
            {pending === "delete" ? "Menghapus…" : "Hapus kredensial"}
          </button>
        </section>
      )}
    </>
  );
}
