import "server-only";
import type { User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/audit";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { runsPerDay } from "@/server/leads/schedule";

/**
 * Pengelolaan paket langganan oleh Superadmin.
 *
 * Harga dan kuota di sini benar-benar ditegakkan server saat pengguna mencari,
 * membalas, dan menambah kata kunci, serta tampil di halaman harga publik.
 * Karena itu nilainya divalidasi terhadap dua kenyataan: jadwal pencarian
 * penuh harus muat dalam kuota bulanan, dan pemakaian harian harus tetap di
 * bawah batas Meta per akun Threads.
 */

/** Batas Meta per akun Threads yang terhubung, per 24 jam. */
const META_DAILY_SEARCH_LIMIT = 2_200;
const META_DAILY_REPLY_LIMIT = 1_000;
const DAYS_IN_MONTH = 30;

const planFields = {
  name: z.string().trim().min(2, "Nama paket minimal 2 karakter.").max(100),
  monthlyPrice: z.number().int("Harga harus bilangan bulat Rupiah.").min(0).max(1_000_000_000),
  monthlySearchLimit: z.number().int().min(0).max(1_000_000),
  monthlyReplyLimit: z.number().int().min(0).max(1_000_000),
  keywordLimit: z.number().int().min(0).max(1_000),
  searchIntervalHours: z.number().int().min(1, "Interval minimal 1 jam.").max(168, "Interval maksimal 168 jam."),
  isActive: z.boolean(),
};

export const createPlanSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,50}$/, "Kode hanya huruf kapital, angka, dan garis bawah (2 sampai 50 karakter)."),
  ...planFields,
});

export const updatePlanSchema = z.object(planFields);

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

type Limits = Pick<UpdatePlanInput, "monthlySearchLimit" | "monthlyReplyLimit" | "keywordLimit" | "searchIntervalHours">;

/**
 * Memeriksa kewajaran kuota terhadap jadwal dan batas Meta.
 * Batas bernilai nol berarti tanpa batas, jadi tidak ikut diperiksa.
 */
export function planQuotaIssues(limits: Limits): string[] {
  const issues: string[] = [];
  const searchesPerDay = limits.keywordLimit * runsPerDay("HOURLY", limits.searchIntervalHours);

  if (limits.monthlySearchLimit > 0 && limits.keywordLimit > 0) {
    const projected = Math.round(searchesPerDay * DAYS_IN_MONTH);
    if (projected > limits.monthlySearchLimit) {
      issues.push(
        `Jadwal penuh memproyeksikan ${projected.toLocaleString("id-ID")} pencarian per bulan, di atas kuota ${limits.monthlySearchLimit.toLocaleString("id-ID")}. ` +
        `Perbesar kuota pencarian, kurangi batas kata kunci, atau perpanjang interval.`,
      );
    }
  }

  if (searchesPerDay >= META_DAILY_SEARCH_LIMIT) {
    issues.push(`Jadwal penuh memakai ${Math.round(searchesPerDay).toLocaleString("id-ID")} pencarian per hari, melampaui batas Meta ${META_DAILY_SEARCH_LIMIT.toLocaleString("id-ID")} per 24 jam.`);
  }

  if (limits.monthlyReplyLimit > 0 && limits.monthlyReplyLimit / DAYS_IN_MONTH >= META_DAILY_REPLY_LIMIT) {
    issues.push(`Kuota balasan setara ${Math.round(limits.monthlyReplyLimit / DAYS_IN_MONTH).toLocaleString("id-ID")} per hari, melampaui batas Meta ${META_DAILY_REPLY_LIMIT.toLocaleString("id-ID")} per 24 jam.`);
  }

  return issues;
}

function assertQuotaSane(limits: Limits) {
  const issues = planQuotaIssues(limits);
  if (issues.length > 0) throw new ThreadsIntegrationError("PLAN_QUOTA_INVALID", issues[0], 400);
}

export async function createPlan(actor: User, input: CreatePlanInput) {
  assertQuotaSane(input);

  const existing = await prisma.plan.findUnique({ where: { code: input.code }, select: { id: true } });
  if (existing) throw new ThreadsIntegrationError("PLAN_CODE_TAKEN", `Kode paket ${input.code} sudah dipakai.`, 409);

  const plan = await prisma.plan.create({ data: input });
  await recordAudit({
    actorId: actor.id,
    action: "PLAN_CREATED",
    entityType: "Plan",
    entityId: plan.id,
    metadata: { code: plan.code, monthlyPrice: Number(plan.monthlyPrice) },
  });
  return plan;
}

export async function updatePlan(actor: User, planId: string, input: UpdatePlanInput) {
  assertQuotaSane(input);

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new ThreadsIntegrationError("PLAN_NOT_FOUND", "Paket tidak ditemukan.", 404);

  // Menonaktifkan paket yang masih dipakai langganan akan mengubah batas yang
  // berlaku bagi pelanggannya, jadi ditolak sampai langganannya dipindahkan.
  if (plan.isActive && !input.isActive) {
    const active = await prisma.subscription.count({
      where: { planId, status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } },
    });
    if (active > 0) {
      throw new ThreadsIntegrationError(
        "PLAN_IN_USE",
        `Paket ini masih dipakai ${active} langganan aktif. Pindahkan langganannya sebelum menonaktifkan paket.`,
        409,
      );
    }
  }

  const updated = await prisma.plan.update({ where: { id: planId }, data: input });
  await recordAudit({
    actorId: actor.id,
    action: "PLAN_UPDATED",
    entityType: "Plan",
    entityId: planId,
    metadata: { code: updated.code, monthlyPrice: Number(updated.monthlyPrice), isActive: updated.isActive },
  });
  return updated;
}

export type AdminPlan = {
  id: string;
  code: string;
  name: string;
  monthlyPrice: number;
  monthlySearchLimit: number;
  monthlyReplyLimit: number;
  keywordLimit: number;
  searchIntervalHours: number;
  isActive: boolean;
  subscriptions: number;
  projectedMonthlySearches: number;
  quotaIssues: string[];
  inCatalog: boolean;
};

export async function listPlansForAdmin(catalogCodes: string[]): Promise<AdminPlan[]> {
  const plans = await prisma.plan.findMany({
    orderBy: [{ isActive: "desc" }, { monthlyPrice: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });

  return plans.map(plan => ({
    id: plan.id,
    code: plan.code,
    name: plan.name,
    monthlyPrice: Number(plan.monthlyPrice),
    monthlySearchLimit: plan.monthlySearchLimit,
    monthlyReplyLimit: plan.monthlyReplyLimit,
    keywordLimit: plan.keywordLimit,
    searchIntervalHours: plan.searchIntervalHours,
    isActive: plan.isActive,
    subscriptions: plan._count.subscriptions,
    projectedMonthlySearches: Math.round(plan.keywordLimit * runsPerDay("HOURLY", plan.searchIntervalHours) * DAYS_IN_MONTH),
    quotaIssues: planQuotaIssues(plan),
    inCatalog: catalogCodes.includes(plan.code),
  }));
}
