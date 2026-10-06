import { DashboardShell } from "@/components/dashboard-shell";
import { requirePageRole } from "@/server/auth/page-guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole(["ADMIN", "SUPERADMIN"], "/admin");
  return <DashboardShell user={{ name: user.name, workspace: "Tim Operasional", role: "admin" }}>{children}</DashboardShell>;
}
