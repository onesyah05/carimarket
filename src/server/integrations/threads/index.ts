import "server-only";
import { localThreadsAdapter } from "./local-adapter";
import { getValidThreadsToken } from "./connection-service";
import { createLiveThreadsAdapter } from "./live-adapter";
import { createUnofficialThreadsAdapter } from "./unofficial-adapter";
import { loadUnofficialCredentials } from "./unofficial-credentials";
import type { ThreadsAdapter, ThreadSearchResult } from "./types";

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

/**
 * Menggabungkan keduanya ketika pengguna punya koneksi resmi *dan* platform
 * punya cookie.
 *
 * Sebelum App Review disetujui, `keyword_search` resmi menjawab 200 dengan
 * daftar kosong — bukan error. Tanpa penggabungan ini, pengguna yang sudah
 * menghubungkan akunnya justru selalu melihat nol lead, sementara cookie yang
 * sudah diisi Superadmin tidak pernah dipakai: koneksi resmi mereka menang
 * duluan lalu mengembalikan kosong tanpa penjelasan.
 *
 * Jadi pencarian resmi tetap dicoba lebih dulu, dan jalur cookie hanya
 * menyusul bila hasilnya kosong atau gagal. Begitu App Review disetujui,
 * pencarian resmi mulai mengembalikan hasil dan cadangan ini berhenti terpakai
 * dengan sendirinya — tanpa perlu mengubah kode lagi.
 */
export function withCookieSearchFallback(live: ThreadsAdapter, cookie: ThreadsAdapter): ThreadsAdapter {
  return {
    getCapability: () => live.getCapability(),
    publishReply: input => live.publishReply(input),
    getPublishingLimit: () => live.getPublishingLimit(),
    async searchPosts(query: string): Promise<ThreadSearchResult[]> {
      try {
        const results = await live.searchPosts(query);
        if (results.length > 0) return results;
      } catch (error) {
        console.warn(
          `Pencarian Threads resmi gagal, memakai sesi web platform: ${error instanceof Error ? error.message.slice(0, 160) : "penyebab tidak diketahui"}`,
        );
      }
      return cookie.searchPosts(query);
    },
  };
}

export async function getThreadsAdapter(userId: string): Promise<ThreadsAdapter> {
  const mode = process.env.INTEGRATION_MODE ?? "live";

  if (mode === "local") {
    // Mode lokal masih memungkinkan kredensial tidak resmi bila diisi, agar
    // pencarian bisa diuji tanpa koneksi resmi.
    const unofficial = await loadUnofficialCredentials();
    return unofficial ? createUnofficialThreadsAdapter(unofficial) : localThreadsAdapter;
  }

  let live: ThreadsAdapter | null = null;
  try {
    live = createLiveThreadsAdapter(await getValidThreadsToken(userId));
  } catch {
    // Tidak ada koneksi resmi untuk pengguna ini; coba jalur tidak resmi.
  }

  const unofficial = await loadUnofficialCredentials();
  const cookieAdapter = unofficial ? createUnofficialThreadsAdapter(unofficial) : null;

  if (live && cookieAdapter) return withCookieSearchFallback(live, cookieAdapter);
  if (live) return live;
  if (cookieAdapter) return cookieAdapter;

  // Tidak ada sumber apa pun: lempar agar pengguna tahu harus menghubungkan.
  const { ThreadsIntegrationError } = await import("./errors");
  throw new ThreadsIntegrationError(
    "THREADS_NOT_CONNECTED",
    "Hubungkan akun Threads terlebih dahulu.",
    409,
  );
}
