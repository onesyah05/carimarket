"use client";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return <div className="error-state" role="alert"><h1>Dashboard belum dapat dimuat</h1><p>Data Anda tidak berubah. Coba muat ulang bagian ini.</p><button className="button button--primary" onClick={reset}>Coba lagi</button></div>;
}
