import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard-shell";
import { GraceNotice } from "@/features/billing/components/grace-notice";
import { requirePageUser } from "@/server/auth/page-guards";
import { requireEntitledPage } from "@/server/auth/access-gate";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, grace } = await requireEntitledPage(await requirePageUser("/dashboard"));
  const business = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
  return <DashboardShell user={{ name: user.name, workspace: business?.name ?? "Profil belum diisi", role: "user" }}>
    {grace && <GraceNotice daysLeft={grace.daysLeft} endsAt={grace.endsAt.toISOString()} />}
    {children}
  </DashboardShell>;
}
