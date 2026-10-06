"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";

export function LeadSaveButton({ leadId, initialStatus }: { leadId: string; initialStatus: "Baru" | "Tersimpan" | "Dibalas" }) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function toggle() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/leads/" + encodeURIComponent(leadId) + "/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved: status !== "Tersimpan" }),
      });
      const payload = await response.json() as { error?: string; data?: { status: "Baru" | "Tersimpan" } };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Status lead belum dapat diubah.");
      setStatus(payload.data.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Status lead belum dapat diubah.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="lead-save-control"><button type="button" className="button button--ghost button--small" onClick={() => void toggle()} disabled={busy || status === "Dibalas"}><Bookmark size={15} fill={status === "Tersimpan" ? "currentColor" : "none"} /> {busy ? "Menyimpan..." : status === "Tersimpan" ? "Batal simpan lead" : status === "Dibalas" ? "Sudah dibalas" : "Simpan lead"}</button>{error && <span role="alert">{error}</span>}</div>;
}
