import { SearchFrequency } from "@prisma/client";
import { z } from "zod";
import { ApiError, withApiAuth } from "@/server/api/handler";
import { deleteKeyword, updateKeyword } from "@/server/api/me-service";

export const runtime = "nodejs";

const patchSchema = z.object({
  active: z.boolean().optional(),
  frequency: z.enum(SearchFrequency).optional(),
}).refine(value => value.active !== undefined || value.frequency !== undefined, {
  message: "Sertakan minimal satu dari active atau frequency.",
});

/**
 * Mengubah status aktif atau jadwal kata kunci.
 * Jadwal yang lebih cepat dari paket tetap dibatasi interval paket.
 */
export const PATCH = withApiAuth(async context => {
  const keywordId = await context.param("id");
  const input = await context.json(patchSchema);
  if (input.frequency === SearchFrequency.MANUAL && input.active === false) {
    throw new ApiError("INVALID_INPUT", "Kata kunci manual yang dijeda tidak akan pernah berjalan.");
  }
  return { data: await updateKeyword(context.user.id, keywordId, input) };
});

/** Menghapus kata kunci beserta kaitannya ke lead. */
export const DELETE = withApiAuth(async context => ({
  data: await deleteKeyword(context.user.id, await context.param("id")),
}));
