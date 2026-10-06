"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Sesi dihapus di sisi server saat cookie kedaluwarsa; tetap arahkan ke halaman utama.
    }
    router.push("/");
    router.refresh();
  }

  return (
    <button className="logout-button" type="button" onClick={onLogout} disabled={pending}>
      {pending ? "Keluar…" : "Keluar"}
    </button>
  );
}
