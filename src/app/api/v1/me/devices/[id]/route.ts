import { ApiError, withApiAuth } from "@/server/api/handler";
import { revokeUserDevice } from "@/server/api/mobile-auth";

export const runtime = "nodejs";

/** Mencabut salah satu perangkat milik akun ini. */
export const DELETE = withApiAuth(async context => {
  const deviceId = await context.param("id");
  const revoked = await revokeUserDevice(context.user.id, deviceId);
  if (!revoked) throw new ApiError("NOT_FOUND", "Perangkat tidak ditemukan atau sudah dicabut.");
  return { data: { id: deviceId, revoked: true } };
});
