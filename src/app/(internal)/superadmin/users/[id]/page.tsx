import { notFound } from "next/navigation";
import { PageHeading } from "@/components/dashboard-ui";
import { UserDetailView } from "@/features/admin/components/user-detail-view";
import { UserRowActions } from "@/features/admin/components/user-row-actions";
import { requirePageRole } from "@/server/auth/page-guards";
import { loadUserDetail } from "@/server/admin/user-detail";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

/**
 * Detail pengguna untuk Superadmin: sama isinya dengan konsol Admin, tetapi
 * membawa tindakan akun. Akun Superadmin lain tidak menampilkan tindakan apa
 * pun — aturan yang sama sudah ditegakkan API-nya.
 */
export default async function SuperadminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(["SUPERADMIN"], "/superadmin/users");
  const { id } = await params;

  const detail = await loadUserDetail(id).catch(error => {
    if (error instanceof ThreadsIntegrationError && error.status === 404) notFound();
    throw error;
  });

  return <>
    <PageHeading
      eyebrow="Manajemen pengguna"
      title={detail.account.name}
      copy="Keadaan akun, kuota, koneksi, dan jejak audit dalam satu halaman. Nilai token dan kata sandi tidak pernah ditampilkan."
    />
    <UserDetailView
      detail={detail}
      backHref="/superadmin/users"
      actions={detail.account.role === "SUPERADMIN"
        ? undefined
        : <UserRowActions
          userId={detail.account.id}
          name={detail.account.name}
          status={detail.account.status as "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION"}
          category={detail.profiles[0]?.category ?? null}
        />}
    />
  </>;
}
