import "server-only";
import { localThreadsAdapter } from "./local-adapter";
import { getValidThreadsToken } from "./connection-service";
import { createLiveThreadsAdapter } from "./live-adapter";
import { createUnofficialThreadsAdapter } from "./unofficial-adapter";
import { loadUnofficialCredentials } from "./unofficial-credentials";
import type { ThreadsAdapter } from "./types";

/**
 * Memilih adapter Threads sesuai urutan prioritas:
 * 1. OAuth resmi (live) — bila pengguna sudah menghubungkan akun via Meta.
 * 2. Tidak resmi (cookie sesi web) — bila Superadmin sudah mengisi kredensial
 *    platform. Memungkinkan pencarian sebelum App Review disetujui.
 * 3. Local — data dummy untuk pengembangan tanpa koneksi apa pun.
 *
 * Reply/publish hanya didukung jalur resmi; jalur tidak resmi menolak dengan
 * pesan yang jelas.
 */
export async function getThreadsAdapter(userId: string): Promise<ThreadsAdapter> {
  const mode = process.env.INTEGRATION_MODE ?? "live";

  if (mode === "local") {
    // Mode lokal masih memungkinkan kredensial tidak resmi bila diisi, agar
    // pencarian bisa diuji tanpa koneksi resmi.
    const unofficial = await loadUnofficialCredentials();
    return unofficial ? createUnofficialThreadsAdapter(unofficial) : localThreadsAdapter;
  }

  try {
    const token = await getValidThreadsToken(userId);
    return createLiveThreadsAdapter(token);
  } catch {
    // Tidak ada koneksi resmi untuk pengguna ini; coba jalur tidak resmi.
  }

  const unofficial = await loadUnofficialCredentials();
  if (unofficial) return createUnofficialThreadsAdapter(unofficial);

  // Tidak ada sumber apa pun: lempar agar pengguna tahu harus menghubungkan.
  const { ThreadsIntegrationError } = await import("./errors");
  throw new ThreadsIntegrationError(
    "THREADS_NOT_CONNECTED",
    "Hubungkan akun Threads terlebih dahulu.",
    409,
  );
}
