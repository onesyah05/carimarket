import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "cm_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const protectedGroup = pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/superadmin") || pathname.startsWith("/onboarding");
  const authPage = pathname === "/masuk";

  if (protectedGroup && !hasSession) {
    const url = new URL("/masuk", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (authPage && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/superadmin/:path*", "/onboarding/:path*", "/masuk"],
};
