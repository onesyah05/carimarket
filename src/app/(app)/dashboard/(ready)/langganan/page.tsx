import Link from "next/link";
import { Check, CircleDollarSign } from "lucide-react";
import { PageHeading, QuotaMeter } from "@/components/dashboard-ui";
import { getQuotaSnapshot } from "@/server/usage/limits";
import { getWorkspaceUser } from "@/server/workspace-user";

const PLAN_FEATURES = ["Profil bisnis", "Kata kunci pencarian", "Feed lead", "Mode tinjau dan otomatis"];

function periodLabel(periodStart: Date) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(periodStart);
}

export default async function SubscriptionPage() {
  const user = await getWorkspaceUser();
  const quota = await getQuotaSnapshot(user.id);
  const plan = quota.plan;

  return <>
    <PageHeading eyebrow="Langganan" title="Paket dan kuota" copy={plan ? `Batas di bawah ini berlaku dan ditegakkan server saat Anda mencari atau mengirim balasan.` : "Belum ada paket aktif di platform, jadi pemakaian workspace ini tidak dibatasi."} />
    <div className="subscription-grid">
      <section className="panel current-plan">
        <div className="current-plan__header">
          <div>
            <span>{plan?.source === "subscription" ? "Langganan aktif" : "Paket bawaan platform"}</span>
            <h2>{plan?.name ?? "Tanpa batas"}</h2>
            <p>{plan?.source === "subscription" ? "Terhubung ke langganan akun Anda" : plan ? "Dipakai selama Anda belum memiliki langganan sendiri" : "Tambahkan paket dari panel Superadmin untuk menetapkan batas"}</p>
          </div>
          <i><CircleDollarSign /></i>
        </div>
        <ul>{PLAN_FEATURES.map(item => <li key={item}><Check size={16} />{item}</li>)}</ul>
        <Link className="button button--ghost" href="/harga">Baca kebijakan harga</Link>
      </section>

      <section className="panel quota-panel">
        <div className="panel-heading"><div><h2>Pemakaian {periodLabel(quota.periodStart)}</h2><p>Dihitung ulang setiap awal bulan (UTC).</p></div></div>
        {quota.search.limit === null && quota.reply.limit === null
          ? <p className="billing-note">Tidak ada batas yang ditetapkan. Pencarian: {quota.search.used}. Balasan: {quota.reply.used}. Kata kunci: {quota.keywords.used}.</p>
          : <>
            {quota.search.limit !== null && <QuotaMeter label="Pencarian" used={quota.search.used} total={quota.search.limit} />}
            {quota.reply.limit !== null && <QuotaMeter label="Balasan terkirim" used={quota.reply.used} total={quota.reply.limit} color="yellow" />}
            {quota.keywords.limit !== null && <QuotaMeter label="Kata kunci aktif" used={quota.keywords.used} total={quota.keywords.limit} />}
            <p className="billing-note">{quota.search.allowed && quota.reply.allowed
              ? quota.search.warning || quota.reply.warning
                ? "Pemakaian mendekati batas paket. Permintaan baru ditolak setelah batas tercapai."
                : "Pemakaian masih dalam batas paket."
              : "Batas paket sudah tercapai. Pencarian atau balasan baru ditolak sampai periode berikutnya."}</p>
          </>}
        <Link className="button button--primary" href="/kontak">Diskusikan kebutuhan tim</Link>
      </section>
    </div>
  </>;
}
