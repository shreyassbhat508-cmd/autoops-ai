import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/dashboard", "/booking", "/receipts", "/recovery", "/onboarding"];
const AUTH_PAGES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => path.startsWith(p));

  // Not logged in, trying to reach a protected page -> bounce to login
  // and remember where they were headed.
  if (isProtected && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Logged in, but email not yet verified -> force through verification
  // (Supabase sets email_confirmed_at only after the user clicks the link).
  if (isProtected && user && !user.email_confirmed_at) {
    return NextResponse.redirect(new URL("/verify-email", request.url));
  }

  // Already logged in and verified, trying to view login/signup -> send to dashboard.
  if (isAuthPage && user && user.email_confirmed_at) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files, image optimization, and API
     * routes. API routes (in particular /api/voice/*) authenticate via
     * their own mechanism (Twilio request-signature verification + the
     * service-role admin client) rather than the cookie-based session
     * this middleware refreshes — running it on those requests would
     * just add latency to a live phone call for no benefit.
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
