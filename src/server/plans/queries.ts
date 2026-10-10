import "server-only";
import { prisma } from "@/lib/prisma";
import { PLAN_CATALOG } from "../../../prisma/plan-catalog";

/**
 * Paket untuk halaman harga publik.
 *
 * Harga dan kuota dibaca dari database agar dapat diubah tanpa deploy,
 * sedangkan teks pendamping (tagline dan daftar keunggulan) berasal dari
 * katalog di repositori. Paket di database yang tidak ada di katalog tetap
 * ditampilkan dengan keunggulan yang diturunkan dari kuotanya.
 */

export type PublicPlan = {
  code: string;
  name: string;
  monthlyPrice: number;
  monthlySearchLimit: number;
  monthlyReplyLimit: number;
  keywordLimit: number;
  tagline: string;
  highlights: string[];
  featured: boolean;
};

export function describeQuota(plan: { monthlySearchLimit: number; monthlyReplyLimit: number; keywordLimit: number }) {
  return [
    `${plan.keywordLimit.toLocaleString("id-ID")} kata kunci`,
    `${plan.monthlySearchLimit.toLocaleString("id-ID")} pencarian per bulan`,
    `${plan.monthlyReplyLimit.toLocaleString("id-ID")} balasan per bulan`,
  ];
}

export async function listPublicPlans(): Promise<PublicPlan[]> {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { monthlyPrice: "asc" },
  });

  return plans.map(plan => {
    const copy = PLAN_CATALOG.find(entry => entry.code === plan.code);
    return {
      code: plan.code,
      name: plan.name,
      monthlyPrice: Number(plan.monthlyPrice),
      monthlySearchLimit: plan.monthlySearchLimit,
      monthlyReplyLimit: plan.monthlyReplyLimit,
      keywordLimit: plan.keywordLimit,
      tagline: copy?.tagline ?? "Paket langganan Cari Market.",
      highlights: copy?.highlights ?? describeQuota(plan),
      featured: copy?.featured ?? false,
    };
  });
}
