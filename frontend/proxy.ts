import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Must match the API's cookie name (app/config.py: cookie_name).
const SESSION_COOKIE = "ch_session";

/**
 * First auth layer: bounce owner-only routes to /login when the session
 * cookie is missing. This is UX only - the API validates the JWT on every
 * protected endpoint, so a forged cookie gets an empty page, not data.
 */
export function proxy(request: NextRequest) {
  // The coding workspace talks to a loopback-only companion during local
  // development. Let that surface boot without a Google OAuth round trip;
  // production and remote API calls remain owner-authenticated.
  const isLocalCodingDev =
    process.env.NODE_ENV === "development" &&
    request.nextUrl.pathname.startsWith("/coding") &&
    ["localhost", "127.0.0.1"].includes(request.nextUrl.hostname);
  if (isLocalCodingDev) return NextResponse.next();

  // Curated example routes contain no owner data and are intentionally public.
  if (
    request.nextUrl.pathname === "/quenoseteolvide/showcase" ||
    request.nextUrl.pathname.startsWith("/quenoseteolvide/showcase/") ||
    request.nextUrl.pathname === "/brain/examples" ||
    request.nextUrl.pathname.startsWith("/brain/examples/")
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Keep in sync with ownerOnlyPaths in lib/sections.ts.
  matcher: [
    "/blog/:path*",
    "/challenges/:path*",
    "/quenoseteolvide/:path*",
    "/journal/:path*",
    "/dashboard/:path*",
    "/brain/:path*",
    "/coding/:path*",
  ],
};
