import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Must match the API's cookie name (app/config.py: cookie_name).
const SESSION_COOKIE = "ch_session";

/**
 * First auth layer: bounce owner-only routes to /login when the session
 * cookie is missing. This is UX only — the API validates the JWT on every
 * protected endpoint, so a forged cookie gets an empty page, not data.
 */
export function proxy(request: NextRequest) {
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
    "/recipes/:path*",
    "/challenges/:path*",
    "/language/:path*",
    "/journal/:path*",
    "/dashboard/:path*",
  ],
};
