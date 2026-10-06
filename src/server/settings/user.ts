import "server-only";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { getWorkspaceUser } from "@/server/workspace-user";

export async function getSettingsUser() {
  const user = await getWorkspaceUser();
  if (user.role !== "USER") {
    throw new ThreadsIntegrationError("FORBIDDEN", "Anda tidak memiliki akses ke pengaturan ini.", 403);
  }
  return user;
}
