import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server Supabase client for Server Components / Server Actions / Route
 * Handlers. Reads the user's session from cookies — RLS still applies,
 * this does NOT bypass row-level security (that's the service-role
 * client below, for privileged server-only operations).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware refreshes the
            // session instead. Safe to ignore.
          }
        },
      },
    }
  );
}

/**
 * Service-role client — SERVER-ONLY, never import from a Client
 * Component or expose to the browser (section 19.2). Bypasses RLS.
 * Reserve for a short, explicit allowlist of privileged operations
 * (e.g. sending invitations) — do all normal reads/writes through the
 * RLS-scoped client above.
 */
export function createServiceRoleClient() {
  if (typeof window !== "undefined") {
    throw new Error("createServiceRoleClient must never be called from the browser.");
  }
  return createSupabaseServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
