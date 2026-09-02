import type { Role } from "@/lib/constants/roles";

/**
 * The authenticated identity for the current request, derived from the
 * Supabase session (see lib/auth/get-current-user.ts) — not a fixture.
 * Same shape the shell/nav/Home dashboard already expected in Phase 1+2
 * (previously lib/mock/current-user.ts's MockUser) so those consumers
 * did not need to change beyond the import path.
 */
export interface AppUser {
  id: string;
  displayName: string;
  fullName: string;
  role: Role;
  groupId?: string;
  groupName?: string;
  avatarUrl?: string | null;
  email: string;
  programId: string;
  membershipStatus: "invited" | "active" | "suspended" | "archived";
}
