import { PageHeading } from "@/components/dashboard-ui";
import { SettingsPanel } from "@/features/settings/components/settings-panel";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/server/auth/page-guards";
import { hasCompleteBusinessProfile } from "@/server/settings/business-profile";
import { getAccountOverview } from "@/server/settings/account";

export default async function SettingsPage() {
  const user = await requirePageRole(["USER"], "/dashboard/pengaturan");
  const profile = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
  return <><PageHeading eyebrow="Workspace bisnis" title="Pengaturan" copy="Atur profil bisnis, mode balasan, koneksi, notifikasi, dan privasi." /><SettingsPanel profileComplete={hasCompleteBusinessProfile(profile)} account={await getAccountOverview(user)} /></>;
}
