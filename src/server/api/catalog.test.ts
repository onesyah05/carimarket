import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_ENDPOINTS, API_GROUPS, endpointsByGroup } from "./catalog";
import { API_ERROR_CODES } from "./response";

/** Memetakan folder rute Next menjadi daftar path API yang sebenarnya ada. */
function collectRoutes(directory: string, prefix: string): Array<{ path: string; methods: string[] }> {
  const routes: Array<{ path: string; methods: string[] }> = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      const segment = entry.startsWith("[") && entry.endsWith("]") ? `{${entry.slice(1, -1)}}` : entry;
      routes.push(...collectRoutes(full, `${prefix}/${segment}`));
      continue;
    }
    if (entry !== "route.ts") continue;
    const source = readFile(full);
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter(method =>
      new RegExp(`export const ${method}\\b|export async function ${method}\\b`).test(source),
    );
    routes.push({ path: prefix || "/", methods });
  }
  return routes;
}

function readFile(path: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("node:fs") as typeof import("node:fs")).readFileSync(path, "utf8");
}

const implemented = collectRoutes(join(process.cwd(), "src/app/api/v1"), "/api/v1");

describe("katalog API", () => {
  it("mendaftarkan setiap endpoint yang benar-benar ada", () => {
    const documented = new Set(API_ENDPOINTS.map(endpoint => `${endpoint.method} ${endpoint.path}`));
    const missing: string[] = [];
    for (const route of implemented) {
      for (const method of route.methods) {
        if (!documented.has(`${method} ${route.path}`)) missing.push(`${method} ${route.path}`);
      }
    }
    expect(missing, "endpoint belum didokumentasikan").toEqual([]);
  });

  it("tidak mendokumentasikan endpoint yang tidak ada", () => {
    const actual = new Set(implemented.flatMap(route => route.methods.map(method => `${method} ${route.path}`)));
    const extra = API_ENDPOINTS.map(endpoint => `${endpoint.method} ${endpoint.path}`).filter(key => !actual.has(key));
    expect(extra, "dokumentasi menyebut endpoint yang tidak ada").toEqual([]);
  });

  it("hanya mencakup menu pengguna dan autentikasinya", () => {
    for (const endpoint of API_ENDPOINTS) {
      const allowed = endpoint.path.startsWith("/api/v1/me") || endpoint.path.startsWith("/api/v1/auth");
      expect(allowed, endpoint.path).toBe(true);
    }
  });

  it("tidak pernah memuat endpoint admin", () => {
    for (const endpoint of API_ENDPOINTS) {
      expect(endpoint.path).not.toContain("/admin");
      expect(endpoint.path).not.toContain("/superadmin");
    }
  });

  it("memakai kombinasi metode dan path yang unik", () => {
    const keys = API_ENDPOINTS.map(endpoint => `${endpoint.method} ${endpoint.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("menempatkan setiap endpoint pada grup yang terdaftar", () => {
    const groups = new Set<string>(API_GROUPS.map(group => group.name));
    for (const endpoint of API_ENDPOINTS) {
      expect(groups.has(endpoint.group), `grup ${endpoint.group}`).toBe(true);
    }
    for (const group of endpointsByGroup()) {
      expect(group.endpoints.length, `grup ${group.name} kosong`).toBeGreaterThan(0);
    }
  });

  it("melengkapi setiap endpoint dengan ringkasan dan contoh data", () => {
    for (const endpoint of API_ENDPOINTS) {
      expect(endpoint.summary.length, endpoint.path).toBeGreaterThan(5);
      expect(endpoint.dataExample, endpoint.path).toBeDefined();
    }
  });

  it("hanya menyebut kode error yang terdokumentasi", () => {
    const known = new Set(Object.keys(API_ERROR_CODES));
    for (const endpoint of API_ENDPOINTS) {
      for (const code of endpoint.errors ?? []) {
        expect(known.has(code), `kode ${code} pada ${endpoint.path}`).toBe(true);
      }
    }
  });

  it("mendeskripsikan setiap parameter dan kolom", () => {
    for (const endpoint of API_ENDPOINTS) {
      for (const field of [...(endpoint.query ?? []), ...(endpoint.body ?? [])]) {
        expect(field.description.length, `${endpoint.path} ${field.name}`).toBeGreaterThan(5);
      }
    }
  });
});
