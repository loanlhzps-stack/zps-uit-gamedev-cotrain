import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createNotifications } from "@/lib/notifications/create";
import { resolvePendingSubmitters } from "@/lib/assignments/pending-submitters";

export const dynamic = "force-dynamic";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

// How far apart two reminders about the *same* thing (same notification
// type + link_href) are allowed to land. The cron is meant to run once a
// day (see vercel.json), so 20h (not a full 24h) absorbs normal run-time
// jitter while still guaranteeing at most one nudge per day, and also
// prevents this escalation pass from double-firing on the very session
// that notifySessionCompleted (lib/actions/schedule.ts) already notified
// moments earlier the same day.
const DEDUP_WINDOW_HOURS = 20;

// Escalation only looks at recently-completed sessions. A sheet still
// missing after 2 weeks is a manual follow-up problem for Owner/Co-owner,
// not something a daily nudge will fix — and without a cutoff this query
// would grow to scan the program's entire history forever.
const ESCALATION_LOOKBACK_DAYS = 14;

// Section 12 — "remind about upcoming deadlines." No exact lead time is
// specified in the design doc; 48h gives students a working day-plus of
// notice without nagging days in advance.
const DEADLINE_WINDOW_HOURS = 48;

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

/**
 * Vercel Cron endpoint (see vercel.json) — the two notification types
 * that are genuinely time-based rather than triggered by a user action:
 *
 * 1. missing_attendance_sheet escalation — notifySessionCompleted (in
 *    lib/actions/schedule.ts) already fires the moment a session is
 *    marked completed. This pass re-checks still-missing sheets on
 *    every later day and escalates: same notification type, but now
 *    also CC's Owner/Co-owner (not just the group's mentors), since the
 *    immediate nudge did not get it done.
 * 2. deadline reminders — assignments due within DEADLINE_WINDOW_HOURS
 *    with students/groups still in 'draft'/'needs_revision'
 *    (resolvePendingSubmitters, shared with the manual "remind" action
 *    in lib/actions/notifications.ts).
 *
 * Runs across every active program (the app is multi-program — see
 * programs.status). Uses the service-role client because there is no
 * signed-in user driving this request; RLS's notifications_insert only
 * allows an active program member to insert for themselves anyway, so a
 * cron job could not satisfy it as any single user.
 *
 * group_change has no notification hook yet — deferred (see README):
 * there is no "reassign member to a different group" feature built at
 * all yet, so there is nothing for a notification to announce.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET chưa được cấu hình." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("id")
    .eq("status", "active");
  if (programsError) {
    return NextResponse.json({ error: programsError.message }, { status: 500 });
  }

  let missingAttendanceEscalations = 0;
  let deadlineReminders = 0;

  for (const program of programs ?? []) {
    missingAttendanceEscalations += await escalateMissingAttendance(supabase, program.id);
    deadlineReminders += await sendDeadlineReminders(supabase, program.id);
  }

  return NextResponse.json({ ok: true, missingAttendanceEscalations, deadlineReminders });
}

async function escalateMissingAttendance(supabase: ServiceClient, programId: string): Promise<number> {
  const lookbackDate = new Date(Date.now() - ESCALATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [{ data: sessions }, { data: groups }, { data: owners }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id")
      .eq("program_id", programId)
      .eq("status", "completed")
      .gte("session_date", lookbackDate),
    supabase.from("groups").select("id").eq("program_id", programId),
    supabase
      .from("program_memberships")
      .select("profile_id")
      .eq("program_id", programId)
      .eq("status", "active")
      .in("role", ["owner", "co_owner"]),
  ]);

  const groupIds = (groups ?? []).map((g) => g.id);
  if (!sessions || sessions.length === 0 || groupIds.length === 0) return 0;

  const ownerCoOwnerIds = [...new Set((owners ?? []).map((o) => o.profile_id).filter((id): id is string => !!id))];

  const { data: mentors } = await supabase
    .from("mentor_assignments")
    .select("group_id, profile_id")
    .in("group_id", groupIds);

  let sentCount = 0;
  for (const session of sessions) {
    const { data: sheets } = await supabase.from("attendance_sheets").select("group_id").eq("session_id", session.id);
    const sheetGroupIds = new Set((sheets ?? []).map((s) => s.group_id));
    const missingGroupIds = groupIds.filter((id) => !sheetGroupIds.has(id));

    for (const groupId of missingGroupIds) {
      const linkHref = `/app/attendance/${session.id}/${groupId}`;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("type", "missing_attendance_sheet")
        .eq("link_href", linkHref)
        .gte("created_at", hoursAgoIso(DEDUP_WINDOW_HOURS));
      if ((count ?? 0) > 0) continue;

      const mentorIds = (mentors ?? []).filter((m) => m.group_id === groupId).map((m) => m.profile_id);
      const recipientIds = [...new Set([...mentorIds, ...ownerCoOwnerIds])];
      if (recipientIds.length === 0) continue;

      await createNotifications(supabase, {
        programId,
        recipientProfileIds: recipientIds,
        type: "missing_attendance_sheet",
        title: "Điểm danh vẫn còn thiếu — vui lòng bổ sung",
        linkHref,
      });
      sentCount++;
    }
  }
  return sentCount;
}

async function sendDeadlineReminders(supabase: ServiceClient, programId: string): Promise<number> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + DEADLINE_WINDOW_HOURS * 60 * 60 * 1000);

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id")
    .eq("program_id", programId)
    .not("status", "in", "(draft,archived,completed)")
    .not("due_at", "is", null)
    .gte("due_at", now.toISOString())
    .lte("due_at", windowEnd.toISOString());
  if (!assignments || assignments.length === 0) return 0;

  let sentCount = 0;
  for (const assignment of assignments) {
    const linkHref = `/app/assignments/${assignment.id}`;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("type", "deadline")
      .eq("link_href", linkHref)
      .gte("created_at", hoursAgoIso(DEDUP_WINDOW_HOURS));
    if ((count ?? 0) > 0) continue;

    const recipientIds = await resolvePendingSubmitters(supabase, assignment.id);
    if (recipientIds.length === 0) continue;

    await createNotifications(supabase, {
      programId,
      recipientProfileIds: recipientIds,
      type: "deadline",
      title: "Sắp đến hạn nộp bài",
      body: `Bài tập sẽ đến hạn trong vòng ${DEADLINE_WINDOW_HOURS} giờ tới — hãy nộp sớm nếu chưa hoàn thành.`,
      linkHref,
    });
    sentCount++;
  }
  return sentCount;
}
