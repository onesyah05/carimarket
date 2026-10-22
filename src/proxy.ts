import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "cm_session";

/**
 * Host yang memang dilayani tanpa TLS saat pengembangan.
 *
 * Daftarnya sengaja tertutup dan hanya memuat nama yang tidak dapat
 * menunjuk mesin orang lain, jadi pengecualian ini tidak pernah berlaku di
 * produksi betapa pun header yang dikirim klien.
 */
function isLocalHost(hostname: string) {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname === "[::1]"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".test");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // Pengunjung yang datang lewat http dinaikkan ke https sebelum apa pun
  // dikerjakan. Halaman http menghasilkan Origin http:// yang ditolak penjaga
  // same-origin, sehingga setiap pengiriman form berakhir dengan "Origin
  // permintaan tidak diizinkan" — kesalahan yang tidak ada hubungannya dengan
  // apa yang diketik pengguna.
  //
  // Host pengembangan lokal dikecualikan. Dugaan sebelumnya adalah
  // `x-forwarded-proto` hanya muncul bila ada proxy di depan; nyatanya server
  // Next sendiri mengisinya dari skema koneksi, sehingga `npm run dev` di http
  // memantulkan **setiap** halaman terlindungi ke https yang tidak dilayani —
  // dashboard dan konsol internal sama sekali tidak dapat dibuka secara lokal.
  if (request.headers.get("x-forwarded-proto") === "http" && !isLocalHost(request.nextUrl.hostname)) {
    const secure = new URL(request.url);
    secure.protocol = "https:";
    return NextResponse.redirect(secure, 308);
  }

  const protectedGroup = pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/superadmin") || pathname.startsWith("/onboarding") || pathname.startsWith("/mulai") || pathname === "/verifikasi/menunggu";
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
  matcher: ["/dashboard/:path*", "/admin/:path*", "/superadmin/:path*", "/onboarding/:path*", "/mulai/:path*", "/verifikasi/menunggu", "/masuk", "/daftar"],
};
