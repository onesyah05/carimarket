import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { enforceRateLimit } from "@/server/http/request-guards";
import { ThreadsIntegrationError } from "@/server/integrations/threads/errors";
import { authenticateApiKey, newRequestId, readBearerKey } from "./credentials";
import {
  API_ERROR_CODES,
  buildMeta,
  errorBody,
  successBody,
  statusForCode,
  type ApiErrorCode,
  type ApiPageMeta,
} from "./response";

/**
 * Pembungkus endpoint API mobile.
 *
 * Menyeragamkan autentikasi kunci API, rate limit per kredensial, bentuk
 * amplop respons, dan pemetaan error menjadi kode yang terdokumentasi.
 * Setiap route handler hanya mengurus logika domainnya.
 */

export type ApiContext = {
  user: User;
  credentialId: string;
  requestId: string;
  searchParams: URLSearchParams;
  /** Body JSON tervalidasi; melempar INVALID_INPUT bila tidak sesuai skema. */
  json<T>(schema: ZodType<T>): Promise<T>;
  /** Segmen dinamis rute, mis. `id` pada /leads/[id]. */
  param(name: string): Promise<string>;
};

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode | string,
    message?: string,
    public readonly details?: Record<string, string> | null,
  ) {
    super(message ?? (API_ERROR_CODES as Record<string, { message: string } | undefined>)[code]?.message ?? "Permintaan gagal.");
    this.name = "ApiError";
  }
}

export type ApiResult<T> = { data: T; page?: ApiPageMeta; status?: number };

const RATE_LIMIT_PER_MINUTE = 120;

function respond(body: unknown, status: number, requestId: string) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
  });
}

function failure(code: string, requestId: string, message?: string, details?: Record<string, string> | null) {
  const known = (API_ERROR_CODES as Record<string, { message: string } | undefined>)[code];
  const meta = buildMeta(requestId);
  return respond(errorBody(code, message ?? known?.message ?? "Permintaan gagal.", meta, details), statusForCode(code), requestId);
}

/**
 * Error dari lapisan layanan dipetakan ke kode API yang stabil, sehingga klien
 * mobile tidak pernah menerima pesan internal maupun kode yang tidak
 * terdokumentasi.
 */
function mapServiceError(error: unknown): { code: string; message?: string } {
  if (error instanceof ApiError) return { code: error.code, message: error.message };

  if (error instanceof ThreadsIntegrationError) {
    if (error.code.endsWith("QUOTA_EXCEEDED")) return { code: "QUOTA_EXCEEDED", message: error.message };
    if (error.code === "RATE_LIMITED") return { code: "RATE_LIMITED", message: error.message };
    if (error.code === "THREADS_NOT_CONFIGURED" || error.code === "THREADS_NOT_CONNECTED") {
      return { code: "THREADS_UNAVAILABLE", message: error.message };
    }
    if (error.status === 404) return { code: "NOT_FOUND", message: error.message };
    if (error.status === 409) return { code: "CONFLICT", message: error.message };
    if (error.status === 403) return { code: "FORBIDDEN", message: error.message };
    if (error.status === 401) return { code: "UNAUTHENTICATED", message: error.message };
    if (error.status === 400) return { code: "INVALID_INPUT", message: error.message };
    return { code: "INTERNAL_ERROR" };
  }

  return { code: "INTERNAL_ERROR" };
}

type RouteSegment = { params: Promise<Record<string, string | string[] | undefined>> };

export function withApiAuth<T>(handler: (context: ApiContext) => Promise<ApiResult<T>>) {
  return async function route(request: Request, segment?: RouteSegment) {
    const requestId = newRequestId();

    const key = readBearerKey(request.headers.get("authorization"));
    if (!key) return failure("UNAUTHENTICATED", requestId);

    const auth = await authenticateApiKey(key);
    if (!auth.ok) return failure(auth.code, requestId);

    try {
      enforceRateLimit(`api-v1:${auth.credential.credentialId}`, RATE_LIMIT_PER_MINUTE, 60_000);
    } catch {
      return failure("RATE_LIMITED", requestId);
    }

    const context: ApiContext = {
      user: auth.credential.user,
      credentialId: auth.credential.credentialId,
      requestId,
      searchParams: new URL(request.url).searchParams,
      async param(name) {
        const params = segment ? await segment.params : {};
        const value = params[name];
        const single = Array.isArray(value) ? value[0] : value;
        if (!single) throw new ApiError("NOT_FOUND", "Sumber daya tidak ditemukan.");
        return single;
      },
      async json(schema) {
        const payload = await request.json().catch(() => null);
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          throw new ApiError("INVALID_INPUT", "Permintaan tidak valid.", fieldErrors(parsed.error));
        }
        return parsed.data;
      },
    };

    try {
      const result = await handler(context);
      const meta = buildMeta(requestId, result.page);
      return respond(successBody(result.data, meta), result.status ?? 200, requestId);
    } catch (error) {
      const mapped = mapServiceError(error);
      if (mapped.code === "INTERNAL_ERROR") {
        // Detail internal hanya ke log server, tidak ke klien.
        console.warn(`API v1 gagal (request ${requestId}): ${error instanceof Error ? error.message.slice(0, 200) : "penyebab tidak diketahui"}`);
      }
      const details = error instanceof ApiError ? error.details : null;
      return failure(mapped.code, requestId, mapped.message, details);
    }
  };
}

function fieldErrors(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "body";
    if (!details[path]) details[path] = issue.message;
  }
  return details;
}

/** Endpoint yang hanya mendukung sebagian metode HTTP. */
export function methodNotAllowed() {
  const requestId = newRequestId();
  return failure("METHOD_NOT_ALLOWED", requestId);
}
