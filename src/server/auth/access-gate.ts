import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getWorkspaceUser } from "@/server/workspace-user";
import { decideAccess, type AccessDecision } from "./access-rules";

/**
 * Penjaga akses ruang kerja, dipakai halaman maupun API.
 *
 * Satu keputusan dipakai di dua tempat supaya antarmuka dan endpoint tidak
 * bisa berbeda pendapat: menutup halaman saja tidak cukup, karena permintaan
 * API dapat dipanggil langsung.
 */

const ACTIVE_SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE"] as const;

export async function hasActiveSubscription(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } },
    select: { id: true },
  });
  return subscription !== null;
}

export async function resolveAccess(user: User): Promise<AccessDecision> {
  // Hanya pelanggan yang perlu diperiksa langganannya; akun internal lolos
  // tanpa menyentuh database sama sekali.
  if (user.role !== "USER") return decideAccess({ role: user.role, status: user.status, createdAt: user.createdAt, hasActiveSubscription: true });

  return decideAccess({
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    hasActiveSubscription: await hasActiveSubscription(user.id),
  });
}

/**
 * Untuk halaman: mengantar pengguna ke langkah yang belum selesai, lalu
 * mengembalikan akun beserta keterangan tenggang agar halaman dapat
 * memperingatkan sebelum tenggangnya habis.
 */
export async function requireEntitledPage(user: User) {
  const decision = await resolveAccess(user);
  if (!decision.allowed) redirect(decision.redirectTo);
  return { user, grace: decision.grace };
}

/**
 * Untuk API ruang kerja: menolak dengan kode yang membedakan "belum
 * terverifikasi" dari "belum berlangganan", sehingga klien dapat mengarahkan
 * pengguna ke langkah yang tepat.
 */
export async function requireEntitledUser(): Promise<User> {
  const user = await getWorkspaceUser();
  const decision = await resolveAccess(user);
  if (!decision.allowed) {
    throw new ThreadsIntegrationError(decision.code, decision.message, 403);
  }
  return user;
}
