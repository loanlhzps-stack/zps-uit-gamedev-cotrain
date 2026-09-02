import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * A Course Assignment's owners still mid-work — has a `submissions`
 * row at `draft` or `needs_revision` (never submitted at all is not
 * detected here, since that needs resolving the assignment's full
 * target audience — see README flagged deviation). Shared by
 * `sendReminder`'s Trainer/Owner "remind pending" scopes
 * (lib/actions/notifications.ts) and the daily deadline-reminder cron
 * (app/api/cron/daily-notifications/route.ts) — plain lib function
 * (no "use server") so both call sites can import it directly.
 */
export async function resolvePendingSubmitters(
  supabase: SupabaseServerClient,
  assignmentId: string
): Promise<string[]> {
  const { data: submissions } = await supabase
    .from("submissions")
    .select("profile_id, group_id, status")
    .eq("assignment_id", assignmentId)
    .in("status", ["draft", "needs_revision"])
    .returns<{ profile_id: string | null; group_id: string | null; status: string }[]>();

  const pending = new Set<string>();
  for (const s of submissions ?? []) {
    if (s.profile_id) pending.add(s.profile_id);
    if (s.group_id) {
      const { data: members } = await supabase.from("group_members").select("profile_id").eq("group_id", s.group_id);
      for (const m of members ?? []) pending.add(m.profile_id);
    }
  }
  return [...pending];
}
