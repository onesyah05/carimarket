"use client";

import { useEffect, useState } from "react";
import { Copy, Smartphone, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Device = {
  id: string;
  name: string;
  source: "SUPERADMIN" | "USER_LOGIN" | "USER_PAIRING";
  sourceLabel: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

type Pairing = { code: string; expiresAt: string };

/**
 * Pemasangan aplikasi mobile oleh pengguna sendiri.
 *
 * Kode berlaku sepuluh menit dan hanya dapat dipakai satu kali, jadi pengguna
 * tidak perlu meminta kredensial ke admin platform.
 */
export function MobileDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairing, setPairing] = useState<Pairing>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/mobile-pairing", { cache: "no-store" })
      .then(async response => response.ok ? (await response.json() as { data?: Device[] }).data ?? [] : [])
      .then(next => { if (active) setDevices(next); })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function refresh() {
    const response = await fetch("/api/settings/mobile-pairing", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { data?: Device[] };
    setDevices(payload.data ?? []);
  }

  async function createCode() {
    setBusy(true);
    setError(undefined);
    setCopied(false);
    try {
      const response = await fetch("/api/settings/mobile-pairing", { method: "POST" });
      const payload = await response.json() as { data?: Pairing; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Kode pemasangan belum dapat dibuat.");
      setPairing(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kode pemasangan belum dapat dibuat.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(device: Device) {
    setError(undefined);
    const response = await fetch(`/api/settings/devices/${encodeURIComponent(device.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setError(payload?.error ?? "Perangkat belum dapat dicabut.");
      return;
    }
    await refresh();
  }

  return <div className="mobile-devices">
    <div>
      <h3>Aplikasi mobile</h3>
      <p>Masuk di aplikasi memakai email dan kata sandi akun ini. Bila akun Anda dibuat lewat Threads dan belum punya kata sandi, pakai kode pemasangan di bawah.</p>
    </div>

    {pairing
      ? <div className="pairing-code" aria-live="polite">
        <span>Masukkan kode ini di aplikasi</span>
        <strong>{pairing.code}</strong>
        <small>Berlaku sampai {formatDateTime(pairing.expiresAt)} dan hanya dapat dipakai satu kali.</small>
        <div className="pairing-code__actions">
          <button className="button button--ghost button--small" type="button" onClick={() => { void navigator.clipboard.writeText(pairing.code).then(() => setCopied(true)).catch(() => setCopied(false)); }}>
            <Copy size={15} /> {copied ? "Tersalin" : "Salin kode"}
          </button>
          <button className="button button--ghost button--small" type="button" onClick={() => void createCode()} disabled={busy}>Buat kode baru</button>
        </div>
      </div>
      : <button className="button button--primary" type="button" onClick={() => void createCode()} disabled={busy}>
        <Smartphone size={16} /> {busy ? "Membuat kode..." : "Buat kode pemasangan"}
      </button>}

    {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}

    <div className="device-list">
      <h4>Perangkat tertaut</h4>
      {loading && <p className="settings-note">Memuat perangkat…</p>}
      {!loading && devices.length === 0 && <p className="settings-note">Belum ada perangkat atau integrasi yang tertaut ke akun ini.</p>}
      {devices.map(device => (
        <div className="device-row" key={device.id}>
          <div>
            <strong>{device.name}</strong>
            <small>{device.sourceLabel} · {device.lastUsedAt ? `terakhir dipakai ${formatDateTime(device.lastUsedAt)}` : "belum pernah dipakai"}</small>
          </div>
          <button className="button button--danger button--small" type="button" onClick={() => void revoke(device)}><Trash2 size={15} /> Cabut</button>
        </div>
      ))}
    </div>
  </div>;
}
