import "server-only";
import type { User } from "@prisma/client";
import { getSessionUser } from "./session";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

export async function requireApiRole(roles: Array<User["role"]>): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    throw new ThreadsIntegrationError("UNAUTHENTICATED", "Sesi Anda berakhir. Silakan masuk kembali.", 401);
  }
  if (user.status !== "ACTIVE") {
    throw new ThreadsIntegrationError("ACCOUNT_INACTIVE", "Akun Anda tidak aktif. Silakan hubungi dukungan.", 403);
  }
  if (!roles.includes(user.role)) {
    throw new ThreadsIntegrationError("FORBIDDEN", "Anda tidak memiliki akses ke aksi ini.", 403);
  }
  return user;
}
