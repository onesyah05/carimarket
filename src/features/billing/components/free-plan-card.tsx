"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";

/**
 * Kartu paket gratis di halaman pemilihan paket.
 *
 * Dipisahkan dari daftar paket berbayar karena alurnya memang berbeda: paket
 * berbayar melewati tagihan dan verifikasi manual, paket gratis aktif pada
 * klik itu juga.
 */
export function FreePlanCard({ name, highlights }: { name: string; highlights: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/paket-gratis", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Paket belum dapat diaktifkan.");
        setPending(false);
        return;
      }
      router.push("/onboarding/bisnis");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
      setPending(false);
    }
  }

  return (
    <section className="panel free-plan">
      <div className="free-plan__head">
        <div>
          <p className="eyebrow"><Sparkles size={14} /> Mulai tanpa biaya</p>
          <h2>{name}</h2>
          <p>Aktif seketika, tanpa pembayaran. Anda dapat naik ke paket berbayar kapan saja dari halaman Langganan.</p>
        </div>
        <button className="button button--primary" type="button" onClick={() => void start()} disabled={pending}>
          {pending ? "Mengaktifkan…" : `Mulai dengan ${name}`}
        </button>
      </div>
      {highlights.length > 0 && <ul className="free-plan__list">
        {highlights.map(item => <li key={item}><Check size={15} /> {item}</li>)}
      </ul>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
