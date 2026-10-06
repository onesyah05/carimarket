import { DashboardShell } from "@/components/dashboard-shell";
import { requirePageRole } from "@/server/auth/page-guards";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole(["SUPERADMIN"], "/superadmin");
  return <DashboardShell user={{ name: user.name, workspace: "Superadmin", role: "superadmin" }}>{children}</DashboardShell>;
}
