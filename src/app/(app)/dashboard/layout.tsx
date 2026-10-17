import { DashboardShell } from "@/components/dashboard-shell";
import { GraceNotice } from "@/features/billing/components/grace-notice";
import { requirePageUser } from "@/server/auth/page-guards";
import { requireEntitledPage } from "@/server/auth/access-gate";
import { profileSwitcherData } from "@/server/workspace/profiles";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, grace } = await requireEntitledPage(await requirePageUser("/dashboard"));
  const workspaces = await profileSwitcherData(user);
  const active = workspaces.profiles.find(profile => profile.id === workspaces.activeId);
  return <DashboardShell user={{ name: user.name, workspace: active?.name ?? "Profil belum diisi", role: "user" }} workspaces={workspaces}>
    {grace && <GraceNotice daysLeft={grace.daysLeft} endsAt={grace.endsAt.toISOString()} />}
    {children}
  </DashboardShell>;
}
