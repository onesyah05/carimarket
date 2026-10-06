import "server-only";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getSessionUser } from "@/server/auth/session";

export async function getWorkspaceUser() {
  if (!process.env.DATABASE_URL) {
    throw new ThreadsIntegrationError("DATABASE_NOT_CONFIGURED", "Workspace belum siap digunakan. Silakan hubungi administrator.", 503);
  }
  const user = await getSessionUser();
  if (!user) {
    throw new ThreadsIntegrationError("UNAUTHENTICATED", "Sesi Anda berakhir. Silakan masuk kembali.", 401);
  }
  if (user.status === "SUSPENDED") {
    throw new ThreadsIntegrationError("ACCOUNT_SUSPENDED", "Akun Anda ditangguhkan. Silakan hubungi dukungan.", 403);
  }
  return user;
}
