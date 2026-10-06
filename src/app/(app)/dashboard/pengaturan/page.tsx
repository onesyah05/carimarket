import { PageHeading } from "@/components/dashboard-ui";
import { SettingsPanel } from "@/features/settings/components/settings-panel";
import { requirePageRole } from "@/server/auth/page-guards";

export default async function SettingsPage() {
  const user = await requirePageRole(["USER"], "/dashboard/pengaturan");
  return <><PageHeading eyebrow="Workspace bisnis" title="Pengaturan" copy="Atur profil bisnis, mode balasan, koneksi, notifikasi, dan privasi." /><SettingsPanel hasPassword={Boolean(user.passwordHash)} /></>;
}
