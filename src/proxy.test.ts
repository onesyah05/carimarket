import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function request(path: string, cookie?: string) {
  const headers = new Headers(cookie ? { cookie: `cm_session=${cookie}` } : {});
  return new NextRequest(new URL(path, "https://carimarket.id"), { headers });
}

describe("proxy", () => {
  it("mengantar pengunjung tanpa cookie ke halaman masuk beserta tujuannya", () => {
    const response = proxy(request("/dashboard/leads?status=baru"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://carimarket.id/masuk?next=%2Fdashboard%2Fleads%3Fstatus%3Dbaru");
  });

  it("meneruskan halaman terlindungi ketika cookie ada, keabsahan diperiksa penjaga halaman", () => {
    expect(proxy(request("/dashboard", "token")).headers.get("location")).toBeNull();
  });

  it("tidak memantulkan halaman masuk walau cookie masih terkirim", () => {
    // Cookie basi dulu memantul tanpa henti antara /masuk dan /dashboard.
    const response = proxy(request("/masuk?next=%2Fdashboard", "cookie-basi"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("membuang cookie basi yang ditandai penjaga halaman", () => {
    const response = proxy(request("/masuk?next=%2Fdashboard&sesi=habis", "cookie-basi"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("cm_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("tidak menyentuh cookie saat halaman masuk dibuka biasa", () => {
    expect(proxy(request("/masuk")).headers.get("set-cookie")).toBeNull();
  });
  it("menaikkan pengunjung http ke https sebelum memeriksa apa pun", () => {
    const response = proxy(new NextRequest("https://carimarket.id/masuk", {
      headers: { "x-forwarded-proto": "http" },
    }));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://carimarket.id/masuk");
  });

  it("membiarkan permintaan https apa adanya", () => {
    const response = proxy(new NextRequest("https://carimarket.id/masuk", {
      headers: { "x-forwarded-proto": "https" },
    }));
    expect(response.status).toBe(200);
  });

  it("tidak mengganggu pengembangan lokal tanpa header skema", () => {
    const response = proxy(new NextRequest("http://127.0.0.1:3100/masuk"));
    expect(response.status).toBe(200);
  });
});
