import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { homePathForRole } from "@/lib/redirects";
import { getSessionUser, hasSessionCookie } from "./session";

/**
 * Tujuan ketika halaman terlindungi dibuka tanpa sesi yang sah.
 *
 * `sesi=habis` menandai cookie yang masih dikirim browser padahal sesinya
 * sudah tidak ada lagi, supaya proxy membuang cookie itu dan halaman masuk
 * dapat menjelaskan alasannya.
 */
function loginPath(nextPath: string | undefined, staleCookie: boolean) {
  const params = new URLSearchParams();
  if (nextPath) params.set("next", nextPath);
  if (staleCookie) params.set("sesi", "habis");
  const query = params.toString();
  return query ? `/masuk?${query}` : "/masuk";
}

export async function requirePageUser(nextPath?: string): Promise<User> {
  const user = await getSessionUser();
  if (!user || user.status === "SUSPENDED") redirect(loginPath(nextPath, await hasSessionCookie()));
  return user;
}

export async function requirePageRole(roles: Array<User["role"]>, nextPath?: string): Promise<User> {
  const user = await requirePageUser(nextPath);
  if (!roles.includes(user.role)) redirect(homePathForRole(user.role));
  return user;
}
