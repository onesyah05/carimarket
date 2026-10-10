import { API_ENDPOINTS, type ApiEndpoint, type ApiField } from "./catalog";
import { API_ERROR_CODES } from "./response";

/**
 * Menyusun dokumen OpenAPI 3.1 dari katalog endpoint.
 *
 * Dipakai developer aplikasi mobile untuk menghasilkan klien. Isinya mengikuti
 * katalog yang sama dengan halaman dokumentasi, jadi keduanya tidak dapat
 * berbeda. Berkas ini hanya dilayani untuk sesi Superadmin.
 */

type OpenApiSchema = Record<string, unknown>;

function fieldSchema(field: ApiField): OpenApiSchema {
  const base: OpenApiSchema = { type: field.type, description: field.description };
  if (field.type === "array") base.items = { type: "string" };
  return base;
}

function pathParameters(path: string) {
  return [...path.matchAll(/\{(\w+)\}/g)].map(match => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
    description: `Identitas ${match[1]} sumber daya.`,
  }));
}

function operation(endpoint: ApiEndpoint) {
  const parameters = [
    ...pathParameters(endpoint.path),
    ...(endpoint.query ?? []).map(field => ({
      name: field.name,
      in: "query",
      required: Boolean(field.required),
      schema: fieldSchema(field),
      description: field.description,
    })),
  ];

  const required = (endpoint.body ?? []).filter(field => field.required).map(field => field.name);

  return {
    operationId: `${endpoint.method.toLowerCase()}${endpoint.path.replace(/[^\w]+/g, "_")}`,
    summary: endpoint.summary,
    description: endpoint.description,
    tags: [endpoint.group],
    ...(parameters.length ? { parameters } : {}),
    ...(endpoint.body?.length
      ? {
        requestBody: {
          required: required.length > 0,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: Object.fromEntries(endpoint.body.map(field => [field.name, fieldSchema(field)])),
                ...(required.length ? { required } : {}),
              },
            },
          },
        },
      }
      : {}),
    responses: {
      "200": {
        description: "Berhasil.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiSuccess" },
            example: { success: true, data: endpoint.dataExample, meta: { requestId: "0f2b7c18-6f1a-4f0d-9d1b-2f1a3b4c5d6e", timestamp: "2026-10-10T08:00:00.000Z" } },
          },
        },
      },
      "4XX": {
        description: `Gagal. Kode yang mungkin: ${[...(endpoint.public ? ["RATE_LIMITED"] : ["UNAUTHENTICATED", "RATE_LIMITED"]), ...(endpoint.errors ?? [])].join(", ")}.`,
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      },
    },
    // Masuk dan pemasangan memang tanpa token.
    security: endpoint.public ? [] : [{ apiKey: [] }],
  };
}

export function buildOpenApiDocument(baseUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of API_ENDPOINTS) {
    paths[endpoint.path] = { ...paths[endpoint.path], [endpoint.method.toLowerCase()]: operation(endpoint) };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Cari Market Mobile API",
      version: "1.0.0",
      description: [
        "API untuk aplikasi mobile Cari Market. Cakupannya hanya menu pengguna bisnis;",
        "tidak ada endpoint admin maupun superadmin.",
        "Autentikasi memakai kunci API yang diterbitkan Superadmin melalui panel platform.",
      ].join(" "),
    },
    servers: [{ url: baseUrl }],
    tags: [...new Set(API_ENDPOINTS.map(endpoint => endpoint.group))].map(name => ({ name })),
    paths,
    components: {
      securitySchemes: {
        apiKey: { type: "http", scheme: "bearer", description: "Kunci API berformat cmk_<prefix>_<rahasia> pada header Authorization." },
      },
      schemas: {
        ApiMeta: {
          type: "object",
          required: ["requestId", "timestamp"],
          properties: {
            requestId: { type: "string", description: "Identitas permintaan, sama dengan header X-Request-Id." },
            timestamp: { type: "string", format: "date-time" },
            page: { $ref: "#/components/schemas/ApiPage" },
          },
        },
        ApiPage: {
          type: "object",
          required: ["page", "perPage", "total", "totalPages", "hasMore"],
          properties: {
            page: { type: "integer" },
            perPage: { type: "integer" },
            total: { type: "integer" },
            totalPages: { type: "integer" },
            hasMore: { type: "boolean" },
          },
        },
        ApiSuccess: {
          type: "object",
          required: ["success", "data", "meta"],
          properties: {
            success: { type: "boolean", const: true },
            data: { description: "Isi respons; bentuknya mengikuti endpoint." },
            meta: { $ref: "#/components/schemas/ApiMeta" },
          },
        },
        ApiError: {
          type: "object",
          required: ["success", "error", "meta"],
          properties: {
            success: { type: "boolean", const: false },
            error: {
              type: "object",
              required: ["code", "message", "details"],
              properties: {
                code: { type: "string", enum: Object.keys(API_ERROR_CODES) },
                message: { type: "string" },
                details: { type: ["object", "null"], additionalProperties: { type: "string" } },
              },
            },
            meta: { $ref: "#/components/schemas/ApiMeta" },
          },
        },
      },
    },
  };
}
