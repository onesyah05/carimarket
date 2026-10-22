import { notFound } from "next/navigation";
import { PageHeading } from "@/components/dashboard-ui";
import { UserDetailView } from "@/features/admin/components/user-detail-view";
import { requirePageRole } from "@/server/auth/page-guards";
import { loadUserDetail } from "@/server/admin/user-detail";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

/**
 * Detail pengguna untuk Admin — hanya baca.
 *
 * Isinya identik dengan konsol Superadmin karena dukungan memang perlu melihat
 * keadaan akun seutuhnya untuk menjawab tiket. Yang tidak ada di sini adalah
 * tindakannya: menangguhkan akun dan mencabut koneksi Threads tetap milik
 * Superadmin, sama seperti yang ditolak API-nya untuk peran Admin.
 */
export default async function AdminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(["ADMIN", "SUPERADMIN"], "/admin/pengguna");
  const { id } = await params;

  const detail = await loadUserDetail(id).catch(error => {
    if (error instanceof ThreadsIntegrationError && error.status === 404) notFound();
    throw error;
  });

  return <>
    <PageHeading
      eyebrow="Dukungan pengguna"
      title={detail.account.name}
      copy="Keadaan akun untuk menjawab tiket. Hanya baca: perubahan status akun dan koneksi Threads dilakukan Superadmin."
    />
    <UserDetailView detail={detail} backHref="/admin/pengguna" />
  </>;
}
