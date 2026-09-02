import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/constants/statuses";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Section 16.1 — shared insert helper for every notification-producing
 * action (checkpoint publish, assignment review, manual reminders).
 * Plain lib function (no "use server") so it can be imported by
 * multiple "use server" action files without becoming a Server Action
 * itself. `notifications_insert` RLS only checks the actor is an
 * active member of the program (0002_rls.sql) — real scope
 * enforcement (who's allowed to notify whom) happens in each calling
 * action, not here.
 */
export async function createNotifications(
  supabase: SupabaseServerClient,
  params: {
    programId: string;
    recipientProfileIds: string[];
    type: NotificationType;
    title: string;
    body?: string | null;
    linkHref?: string | null;
    excludeProfileId?: string;
  }
): Promise<void> {
  const targets = [...new Set(params.recipientProfileIds)].filter((id) => id !== params.excludeProfileId);
  if (targets.length === 0) return;

  await supabase.from("notifications").insert(
    targets.map((profileId) => ({
      program_id: params.programId,
      recipient_profile_id: profileId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link_href: params.linkHref ?? null,
    }))
  );
}
