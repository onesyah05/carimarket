import { z } from "zod";
import { withApiAuth } from "@/server/api/handler";
import { runSearch } from "@/server/api/me-service";

export const runtime = "nodejs";

const schema = z.object({
  query: z.string().trim().min(2, "Kata kunci minimal 2 karakter.").max(100, "Kata kunci maksimal 100 karakter."),
});

/**
 * Menjalankan pencarian Threads untuk satu kata kunci.
 * Kata kunci disimpan ke workspace dan memakai kuota pencarian paket.
 */
export const POST = withApiAuth(async context => {
  const input = await context.json(schema);
  return { data: await runSearch(context.user.id, input.query), status: 201 };
});
