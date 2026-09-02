import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Section 19.2 — "validate membership, role and resource scope on every
// mutation": this is only the first line of defense (keeps a signed-out
// browser out of /app and /onboarding, and a signed-in user out of the
// login form). RLS in supabase/migrations/0002_rls.sql is the real,
// unbypassable gate — every query still runs through it even if this
// check is ever wrong or skipped.
const PROTECTED_PREFIXES = ["/app", "/onboarding"];

export default async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*", "/login"],
};
