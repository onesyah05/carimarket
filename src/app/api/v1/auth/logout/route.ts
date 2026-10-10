import { withApiAuth } from "@/server/api/handler";
import { revokeUserDevice } from "@/server/api/mobile-auth";

export const runtime = "nodejs";

/** Mencabut token yang sedang dipakai. Permintaan berikutnya ditolak 401. */
export const POST = withApiAuth(async context => ({
  data: { revoked: await revokeUserDevice(context.user.id, context.credentialId) },
}));
