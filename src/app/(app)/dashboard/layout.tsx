import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard-shell";
import { requirePageUser } from "@/server/auth/page-guards";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("/dashboard");
  const business = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
  return <DashboardShell user={{ name: user.name, workspace: business?.name ?? "Profil belum diisi", role: "user" }}>{children}</DashboardShell>;
}
