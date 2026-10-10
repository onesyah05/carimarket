import { z } from "zod";
import { withApiAuth } from "@/server/api/handler";
import { getLeadDetail, setLeadSaved } from "@/server/api/me-service";

export const runtime = "nodejs";

const patchSchema = z.object({ saved: z.boolean() });

/** Detail satu lead beserta draft balasan terakhirnya. */
export const GET = withApiAuth(async context => ({
  data: await getLeadDetail(context.user.id, await context.param("id")),
}));

/** Menyimpan atau membatalkan simpan sebuah lead. */
export const PATCH = withApiAuth(async context => {
  const leadId = await context.param("id");
  const input = await context.json(patchSchema);
  return { data: await setLeadSaved(context.user.id, leadId, input.saved) };
});
