import { z } from "zod";
import { withApiAuth } from "@/server/api/handler";
import { saveReplyDraft } from "@/server/replies/send-service";

export const runtime = "nodejs";

const schema = z.object({
  body: z.string().trim().min(1, "Isi draf wajib diisi.").max(500, "Isi draf maksimal 500 karakter."),
  draftId: z.string().trim().min(1).max(191).optional(),
});

/** Menyimpan draft balasan tanpa mengirimnya. */
export const PUT = withApiAuth(async context => {
  const leadId = await context.param("id");
  const input = await context.json(schema);
  const draft = await saveReplyDraft({ userId: context.user.id, leadId, body: input.body, draftId: input.draftId });
  return { data: draft };
});
