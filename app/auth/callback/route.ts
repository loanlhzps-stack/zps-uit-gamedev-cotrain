import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Section 5.1/5.2 — every Supabase Auth email link (account invitation,
// password recovery) redirects here with a `code`. Exchange it for a
// session, then hand off to /app: the protected layout
// (app/app/layout.tsx) decides whether onboarding is still needed.
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/app`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
