"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ModerationActions({ flagId }: { flagId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APPROVE" | "REJECT") {
    setPending(decision);
    setError(null);
    try {
      const response = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagId, decision }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Keputusan belum tersimpan.");
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
    <span className="row-actions">
      <button className="button button--small button--primary" type="button" disabled={pending !== null} onClick={() => void decide("APPROVE")}>
        {pending === "APPROVE" ? "…" : "Setujui"}
      </button>
      <button className="button button--small button--danger" type="button" disabled={pending !== null} onClick={() => void decide("REJECT")}>
        {pending === "REJECT" ? "…" : "Tolak"}
      </button>
      {error && <span className="row-error" role="alert">{error}</span>}
    </span>
  );
}
