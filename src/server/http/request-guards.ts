import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";

const windows = new Map<string, { count: number; resetAt: number }>();

export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || !appUrl) return;
  const submittedOrigin = new URL(origin).origin;
  const configuredOrigin = new URL(appUrl).origin;
  const developmentHost = process.env.NODE_ENV === "development" ? request.headers.get("host") : null;
  if (submittedOrigin !== configuredOrigin && new URL(submittedOrigin).host !== developmentHost) {
    throw new ThreadsIntegrationError("ORIGIN_REJECTED", "Origin permintaan tidak diizinkan.", 403);
  }
}

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) throw new ThreadsIntegrationError("RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi sebentar lagi.", 429);
  current.count += 1;
}
