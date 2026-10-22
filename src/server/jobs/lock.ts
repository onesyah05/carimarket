import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Kunci pekerjaan latar berbasis baris database.
 *
 * Worker berjalan di dalam proses Next.js lewat `instrumentation.ts`, jadi
 * setiap instance tambahan menjalankan siklusnya sendiri: dua instance berarti
 * setiap pencarian terjadwal dikerjakan dua kali dan kuota Meta terpakai dua
 * kali lipat. Itu membuat aplikasi tidak dapat di-scale sama sekali.
 *
 * Kunci ini memakai primary key `JobLock.name`: hanya satu baris yang dapat
 * dibuat untuk satu nama, jadi instance kedua gagal membuatnya dan melewati
 * siklus itu tanpa menunggu. Tidak perlu Redis.
 *
 * Kunci selalu punya masa berlaku. Proses yang mati di tengah siklus tidak
 * sempat melepas kuncinya, dan tanpa kedaluwarsa pekerjaan latar akan berhenti
 * selamanya sampai ada orang yang menghapus barisnya sendiri.
 */

export const CYCLE_LOCK = "worker-cycle";

/** Penanda pemegang kunci, agar pelepasan tidak pernah mengenai kunci orang lain. */
const HOLDER = `${process.pid}-${randomUUID().slice(0, 8)}`;

export type LockResult<T> = { acquired: true; value: T } | { acquired: false; value: null };

async function acquire(name: string, ttlMs: number) {
  const now = new Date();
  // Kunci yang sudah lewat masa berlakunya dibuang lebih dulu; pemiliknya
  // sudah tidak ada lagi.
  await prisma.jobLock.deleteMany({ where: { name, expiresAt: { lte: now } } });
  try {
    await prisma.jobLock.create({
      data: { name, holder: HOLDER, expiresAt: new Date(now.getTime() + ttlMs) },
    });
    return true;
  } catch {
    // Satu-satunya penyebab yang diharapkan adalah bentrokan primary key,
    // yang justru berarti instance lain sedang bekerja.
    return false;
  }
}

async function release(name: string) {
  await prisma.jobLock.deleteMany({ where: { name, holder: HOLDER } }).catch(() => undefined);
}

/**
 * Menjalankan `work` hanya bila kunci berhasil didapat.
 *
 * `ttlMs` harus lebih panjang dari durasi siklus terburuk yang masuk akal,
 * supaya kunci tidak kedaluwarsa sementara pekerjaannya masih berjalan.
 */
export async function withJobLock<T>(name: string, ttlMs: number, work: () => Promise<T>): Promise<LockResult<T>> {
  if (!(await acquire(name, ttlMs))) return { acquired: false, value: null };
  try {
    return { acquired: true, value: await work() };
  } finally {
    await release(name);
  }
}
