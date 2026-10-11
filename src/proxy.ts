import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "cm_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const protectedGroup = pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/superadmin") || pathname.startsWith("/onboarding");
  const authPage = pathname === "/masuk";

  // Cookie hanya diperiksa keberadaannya di sini; keabsahannya diverifikasi ke
  // basis data oleh penjaga halaman. Karena itu halaman masuk tidak boleh
  // memantulkan balik pengunjung yang membawa cookie: cookie basi akan
  // memantul tanpa henti antara /masuk dan halaman terlindungi.
  if (protectedGroup && !hasSession) {
    const url = new URL("/masuk", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Penjaga halaman menandai sesi yang sudah tidak berlaku dengan ?sesi=habis.
  // Cookie-nya dibuang di sini supaya browser berhenti mengirimnya.
  if (authPage && hasSession && request.nextUrl.searchParams.get("sesi") === "habis") {
    const response = NextResponse.next();
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/superadmin/:path*", "/onboarding/:path*", "/masuk"],
};
