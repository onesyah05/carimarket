import { withApiAuth } from "@/server/api/handler";
import { DEFAULT_REPLY_AUTOMATION, getReplyAutomation, replyAutomationSchema, updateReplyAutomation } from "@/server/settings/workspace-settings";

export const runtime = "nodejs";

/** Mode balasan workspace. Bawaannya tinjau dulu bila belum pernah diatur. */
export const GET = withApiAuth(async context => ({
  data: (await getReplyAutomation(context.user.id)) ?? DEFAULT_REPLY_AUTOMATION,
}));

/** Mengubah mode balasan beserta aturan keamanannya. */
export const PUT = withApiAuth(async context => {
  const input = await context.json(replyAutomationSchema);
  return { data: await updateReplyAutomation(context.user.id, input) };
});
