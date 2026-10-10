import { ReplyStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError, withApiAuth } from "@/server/api/handler";
import { listReplies } from "@/server/api/me-service";
import { pageMeta, resolvePagination } from "@/server/api/response";
import { sendReplyFromDraft } from "@/server/replies/send-service";

export const runtime = "nodejs";

const STATUSES = new Set<string>(Object.values(ReplyStatus));

const sendSchema = z.object({
  leadId: z.string().trim().min(1).max(191),
  body: z.string().trim().min(1, "Isi balasan wajib diisi.").max(500, "Isi balasan maksimal 500 karakter."),
  draftId: z.string().trim().min(1).max(191).optional(),
  postId: z.string().trim().min(1).max(191).optional(),
  idempotencyKey: z.string().trim().min(8, "Kunci idempotensi minimal 8 karakter.").max(191),
});

/** Riwayat draft dan balasan, terbaru lebih dahulu. */
export const GET = withApiAuth(async context => {
  const { page, perPage, skip, take } = resolvePagination(context.searchParams);
  const statusParam = context.searchParams.get("status");
  if (statusParam && !STATUSES.has(statusParam)) {
    throw new ApiError("INVALID_INPUT", "Status balasan tidak dikenali.", { status: `Gunakan salah satu dari ${[...STATUSES].join(", ")}.` });
  }
  const result = await listReplies(context.user.id, { status: statusParam ? (statusParam as ReplyStatus) : undefined, skip, take });
  return { data: result.items, page: pageMeta(page, perPage, result.total) };
});

/**
 * Mengirim balasan ke Threads.
 *
 * Memakai kuota balasan paket dan bersifat idempoten: `idempotencyKey` yang
 * sama tidak akan mengirim balasan dua kali.
 */
export const POST = withApiAuth(async context => {
  const input = await context.json(sendSchema);
  const result = await sendReplyFromDraft({ userId: context.user.id, ...input });
  return { data: result, status: 201 };
});
