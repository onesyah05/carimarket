import { withApiAuth } from "@/server/api/handler";
import { getThreadsState } from "@/server/api/me-service";

export const runtime = "nodejs";

/** Status integrasi Threads workspace. Menghubungkan akun tetap lewat peramban. */
export const GET = withApiAuth(async context => ({ data: await getThreadsState(context.user.id) }));
