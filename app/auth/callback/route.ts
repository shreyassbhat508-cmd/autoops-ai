import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// Supabase redirects here after a user clicks the verification link in their
// email, with a one-time `code` param. Exchanging it for a session is what
// actually marks the user's email as confirmed.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Code missing or invalid/expired — send them to login with a message
  // rather than silently failing.
  return NextResponse.redirect(
    `${origin}/login?error=Verification link is invalid or has expired`
  );
}
