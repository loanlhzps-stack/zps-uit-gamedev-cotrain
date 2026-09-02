import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth/current-user";

export type CurrentUserResult =
  | { status: "unauthenticated" }
  | { status: "onboarding_incomplete" }
  | { status: "no_membership" }
  | { status: "suspended" | "archived" }
  | { status: "ok"; user: AppUser };

/**
 * Resolves the real, session-derived identity for the current request.
 * Replaces the Phase 1+2 mock (lib/mock/current-user.ts) — same
 * AppUser shape, but every field now comes from the authenticated
 * user's own row (RLS-scoped client, so this can never read someone
 * else's data — see supabase/migrations/0002_rls.sql).
 */
export async function getCurrentAppUser(): Promise<CurrentUserResult> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { status: "unauthenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, avatar_url, email, onboarding_completed_at")
    .eq("id", authUser.id)
    .maybeSingle();

  // No profile row yet (handle_new_auth_user trigger races the very
  // first request) or onboarding never finished (section 5.2) — either
  // way, send them to /onboarding/profile.
  if (!profile || !profile.onboarding_completed_at) {
    return { status: "onboarding_incomplete" };
  }

  const { data: membership } = await supabase
    .from("program_memberships")
    .select("program_id, role, status")
    .eq("profile_id", authUser.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { status: "no_membership" };
  }
  if (membership.status === "suspended" || membership.status === "archived") {
    return { status: membership.status };
  }
  if (membership.status !== "active") {
    // Still 'invited' after onboarding completed should not happen —
    // completeOnboarding() calls activate_own_membership() — but guard
    // defensively rather than let a half-activated user into /app.
    return { status: "no_membership" };
  }

  let groupId: string | undefined;
  let groupName: string | undefined;
  if (membership.role === "mentor_zps" || membership.role === "mentor_student") {
    const { data: assignment } = await supabase
      .from("mentor_assignments")
      .select("group_id, groups (name)")
      .eq("profile_id", authUser.id)
      .eq("mentor_type", membership.role)
      .maybeSingle<{ group_id: string; groups: { name: string } | null }>();
    groupId = assignment?.group_id ?? undefined;
    groupName = assignment?.groups?.name ?? undefined;
  } else if (membership.role === "student") {
    const { data: member } = await supabase
      .from("group_members")
      .select("group_id, groups (name)")
      .eq("profile_id", authUser.id)
      .maybeSingle<{ group_id: string; groups: { name: string } | null }>();
    groupId = member?.group_id ?? undefined;
    groupName = member?.groups?.name ?? undefined;
  }

  const user: AppUser = {
    id: profile.id,
    displayName: profile.display_name,
    fullName: profile.full_name,
    role: membership.role as AppUser["role"],
    groupId,
    groupName,
    avatarUrl: profile.avatar_url,
    email: profile.email ?? authUser.email ?? "",
    programId: membership.program_id,
    membershipStatus: membership.status as AppUser["membershipStatus"],
  };

  return { status: "ok", user };
}
