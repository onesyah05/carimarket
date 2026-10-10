import { describe, expect, it } from "vitest";
import { homePathForRole, resolveNextPath } from "./redirects";

describe("homePathForRole", () => {
  it("mengarahkan tiap role ke dashboard miliknya", () => {
    expect(homePathForRole("SUPERADMIN")).toBe("/superadmin");
    expect(homePathForRole("ADMIN")).toBe("/admin");
    expect(homePathForRole("USER")).toBe("/dashboard");
    expect(homePathForRole(null)).toBe("/dashboard");
  });
});

describe("resolveNextPath", () => {
  it("menghormati path relatif yang aman", () => {
    expect(resolveNextPath("/dashboard/leads", "USER")).toBe("/dashboard/leads");
  });

  it("menolak pengalihan ke domain lain", () => {
    expect(resolveNextPath("//penyerang.test", "USER")).toBe("/dashboard");
    expect(resolveNextPath("https://penyerang.test", "USER")).toBe("/dashboard");
  });

  it("memakai dashboard role saat next kosong", () => {
    expect(resolveNextPath(null, "ADMIN")).toBe("/admin");
    expect(resolveNextPath(undefined, "SUPERADMIN")).toBe("/superadmin");
  });
});
