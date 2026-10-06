import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { homePathForRole } from "@/lib/redirects";
import { getSessionUser } from "./session";

function loginPath(nextPath?: string) {
  return nextPath ? `/masuk?next=${encodeURIComponent(nextPath)}` : "/masuk";
}

export async function requirePageUser(nextPath?: string): Promise<User> {
  const user = await getSessionUser();
  if (!user || user.status === "SUSPENDED") redirect(loginPath(nextPath));
  return user;
}

export async function requirePageRole(roles: Array<User["role"]>, nextPath?: string): Promise<User> {
  const user = await requirePageUser(nextPath);
  if (!roles.includes(user.role)) redirect(homePathForRole(user.role));
  return user;
}
