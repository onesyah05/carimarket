import { LeadStatus } from "@prisma/client";
import { ApiError, withApiAuth } from "@/server/api/handler";
import { listLeads } from "@/server/api/me-service";
import { pageMeta, resolvePagination } from "@/server/api/response";

export const runtime = "nodejs";

const STATUSES = new Set<string>(Object.values(LeadStatus));

/** Daftar lead workspace dengan penyaringan status, skor minimum, dan kata pencarian. */
export const GET = withApiAuth(async context => {
  const { page, perPage, skip, take } = resolvePagination(context.searchParams);

  const statusParam = context.searchParams.get("status");
  if (statusParam && !STATUSES.has(statusParam)) {
    throw new ApiError("INVALID_INPUT", "Status lead tidak dikenali.", { status: `Gunakan salah satu dari ${[...STATUSES].join(", ")}.` });
  }

  const minScoreParam = context.searchParams.get("minScore");
  const minScore = minScoreParam === null ? undefined : Number(minScoreParam);
  if (minScore !== undefined && (!Number.isFinite(minScore) || minScore < 0 || minScore > 100)) {
    throw new ApiError("INVALID_INPUT", "Skor minimum harus antara 0 dan 100.", { minScore: "Nilai 0 sampai 100." });
  }

  const query = context.searchParams.get("q")?.trim() || undefined;
  const result = await listLeads(context.user.id, {
    status: statusParam ? (statusParam as LeadStatus) : undefined,
    minScore,
    query,
    skip,
    take,
  });

  return { data: result.items, page: pageMeta(page, perPage, result.total) };
});
