import { z } from "zod";
import { withApiAuth } from "@/server/api/handler";
import { createKeyword, listKeywords } from "@/server/api/me-service";

export const runtime = "nodejs";

const createSchema = z.object({
  phrase: z.string().trim().min(2, "Kata kunci minimal 2 karakter.").max(120, "Kata kunci maksimal 120 karakter."),
  negative: z.boolean().default(false),
});

/** Daftar kata kunci beserta batas paket dan jadwal yang berlaku. */
export const GET = withApiAuth(async context => ({ data: await listKeywords(context.user.id) }));

/** Menambah kata kunci pencarian atau kata kunci negatif. */
export const POST = withApiAuth(async context => {
  const input = await context.json(createSchema);
  return { data: await createKeyword(context.user.id, input), status: 201 };
});
