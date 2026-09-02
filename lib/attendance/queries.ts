import { createClient } from "@/lib/supabase/server";
import {
  MAX_ALLOWED_ABSENCES,
  computeGroupHealth,
  deriveGroupHealthFromMembers,
  type GroupHealth,
  type MemberAttendanceTimeline,
} from "@/lib/attendance/health";

// ---------------------------------------------------------------------
// Student's own completion status — section 11.3/9.6.
// ---------------------------------------------------------------------

export interface StudentAttendanceSummary {
  attended: number;
  absences: number;
  recorded: number;
  required: number;
  minRequired: number;
  percentage: number;
  remainingAllowedAbsences: number;
  eligible: boolean;
}

const REQUIRED_SESSIONS = 16;
const MIN_REQUIRED = 13;
// Kept in sync with lib/attendance/health.ts's own MAX_ALLOWED_ABSENCES
// (same section 11.3 rule, imported rather than redefined).

/**
 * Scoped by profile_id only, matching attendance_records_select's own
 * `profile_id = auth.uid()` RLS branch — MVP is single-program (see
 * README), so this does not additionally filter by program_id.
 */
export async function getStudentAttendanceSummary(profileId: string): Promise<StudentAttendanceSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select("status")
    .eq("profile_id", profileId)
    .neq("status", "not_recorded");

  const rows = data ?? [];
  const attended = rows.filter((r) => r.status === "present").length;
  const absences = rows.length - attended;
  const percentage = Math.round((attended / REQUIRED_SESSIONS) * 100);

  return {
    attended,
    absences,
    recorded: rows.length,
    required: REQUIRED_SESSIONS,
    minRequired: MIN_REQUIRED,
    percentage,
    remainingAllowedAbsences: Math.max(0, MAX_ALLOWED_ABSENCES - absences),
    eligible: absences <= MAX_ALLOWED_ABSENCES,
  };
}

// ---------------------------------------------------------------------
// Sponsor aggregate — section 4.3/9.2 (no per-student row access).
// ---------------------------------------------------------------------

export async function getSponsorAttendanceAverage(programId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("program_attendance_summary", { p_program_id: programId })
    .single<{ total: number; present: number; absent: number }>();
  if (error || !data || Number(data.total) === 0) return null;
  return Math.round((Number(data.present) / Number(data.total)) * 100);
}

// ---------------------------------------------------------------------
// Group health grid — section 17.1 (attendance-derived subset only,
// see lib/attendance/health.ts header).
// ---------------------------------------------------------------------

// "Bài tập nhóm đã trễ hạn nộp hơn 1 ngày" signal (theo yêu cầu của
// bạn) — đặt ở đây (không phải lib/assignments/queries.ts) để tránh
// import vòng: lib/assignments/queries.ts đã import getMentorGroupIds/
// getStudentGroupId TỪ file này. Tính CHO CẢ CHƯƠNG TRÌNH trong 1 lượt
// (không phải per-group) để getGroupsWithHealth dùng lại được cho mọi
// nhóm mà không lặp query. CHỈ tính Bài tập nhóm thật sự
// (submission_mode="group", target program/group) — cố ý KHÔNG tính
// Bài tập cá nhân (target=profile): dồn cả bài cá nhân trễ hạn vào
// đây sẽ làm tín hiệu "sức khoẻ nhóm" bị loãng (cùng lý do
// getGroupAssignmentCompletion trong lib/assignments/queries.ts).
const OVERDUE_GRACE_MS = 24 * 60 * 60 * 1000; // "trễ hạn hơn 1 ngày"

export async function getOverdueGroupAssignmentCounts(programId: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const overdueBefore = new Date(Date.now() - OVERDUE_GRACE_MS).toISOString();

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, assignment_targets(target_type, group_id)")
    .eq("program_id", programId)
    .eq("submission_mode", "group")
    .not("due_at", "is", null)
    .lt("due_at", overdueBefore)
    .returns<{ id: string; assignment_targets: { target_type: string; group_id: string | null }[] }[]>();

  const overdueAssignments = assignments ?? [];
  const counts = new Map<string, number>();
  if (overdueAssignments.length === 0) return counts;

  const [{ data: groups }, { data: submissions }] = await Promise.all([
    supabase.from("groups").select("id").eq("program_id", programId).returns<{ id: string }[]>(),
    supabase
      .from("submissions")
      .select("assignment_id, group_id, status")
      .in(
        "assignment_id",
        overdueAssignments.map((a) => a.id)
      )
      .not("group_id", "is", null)
      .in("status", ["submitted", "locked", "completed"])
      .returns<{ assignment_id: string; group_id: string; status: string }[]>(),
  ]);

  const allGroupIds = (groups ?? []).map((g) => g.id);
  const submittedKeys = new Set((submissions ?? []).map((s) => `${s.assignment_id}:${s.group_id}`));

  for (const a of overdueAssignments) {
    const targetsProgram = a.assignment_targets.some((t) => t.target_type === "program");
    const targetGroupIds = targetsProgram
      ? allGroupIds
      : [...new Set(a.assignment_targets.filter((t) => t.target_type === "group" && t.group_id).map((t) => t.group_id as string))];

    for (const groupId of targetGroupIds) {
      if (submittedKeys.has(`${a.id}:${groupId}`)) continue;
      counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
    }
  }
  return counts;
}

export interface GroupHealthInfo {
  id: string;
  name: string;
  memberCount: number;
  health: GroupHealth;
  reasons: string[];
  missingSheetsCount: number;
}

interface GroupRow {
  id: string;
  name: string;
  group_members: { profile_id: string; profiles: { display_name: string } | null }[];
}

interface SessionRow {
  id: string;
  session_date: string;
  status: string;
}

interface SheetRow {
  id: string;
  session_id: string;
  group_id: string;
  status: string;
}

interface RecordRow {
  attendance_sheet_id: string;
  profile_id: string;
  status: "present" | "excused_absence" | "unexcused_absence" | "not_recorded";
}

export async function getGroupsWithHealth(programId: string): Promise<GroupHealthInfo[]> {
  const supabase = await createClient();

  const [{ data: groups }, { data: sessions }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, group_members(profile_id, profiles(display_name))")
      .eq("program_id", programId)
      .order("name")
      .returns<GroupRow[]>(),
    supabase
      .from("sessions")
      .select("id, session_date, status")
      .eq("program_id", programId)
      .in("status", ["attendance_open", "completed"])
      .order("session_date", { ascending: true })
      .returns<SessionRow[]>(),
  ]);

  const groupRows = groups ?? [];
  const sessionRows = sessions ?? [];
  if (groupRows.length === 0) return [];

  const overdueGroupAssignmentCounts = await getOverdueGroupAssignmentCounts(programId);

  if (sessionRows.length === 0) {
    return groupRows.map((g) => {
      const overdueCount = overdueGroupAssignmentCounts.get(g.id) ?? 0;
      const { health, reasons } =
        overdueCount > 0
          ? computeGroupHealth({ overdueGroupAssignmentCount: overdueCount, attentionMemberCount: 0, missingSheetsCount: 0 })
          : { health: "on_track" as const, reasons: ["Chưa có buổi học nào mở điểm danh."] };
      return {
        id: g.id,
        name: g.name,
        memberCount: g.group_members.length,
        health,
        reasons,
        missingSheetsCount: 0,
      };
    });
  }

  const sessionIds = sessionRows.map((s) => s.id);
  const { data: sheets } = await supabase
    .from("attendance_sheets")
    .select("id, session_id, group_id, status")
    .in("session_id", sessionIds)
    .returns<SheetRow[]>();
  const sheetRows = sheets ?? [];

  const finalizedSheetIds = sheetRows.filter((s) => s.status === "locked" || s.status === "reopened").map((s) => s.id);
  const { data: records } = finalizedSheetIds.length
    ? await supabase
        .from("attendance_records")
        .select("attendance_sheet_id, profile_id, status")
        .in("attendance_sheet_id", finalizedSheetIds)
        .returns<RecordRow[]>()
    : { data: [] as RecordRow[] };
  const recordRows = records ?? [];

  const sessionDateById = new Map(sessionRows.map((s) => [s.id, s.session_date]));
  const completedSessionIds = new Set(sessionRows.filter((s) => s.status === "completed").map((s) => s.id));

  return groupRows.map((g) => {
    const groupSheets = sheetRows.filter((s) => s.group_id === g.id);
    const finalizedByGroup = groupSheets.filter((s) => s.status === "locked" || s.status === "reopened");
    const finalizedSessionIds = new Set(finalizedByGroup.map((s) => s.session_id));
    const missingSheetsCount = [...completedSessionIds].filter((id) => !finalizedSessionIds.has(id)).length;

    const orderedSheetIds = [...finalizedByGroup]
      .sort((a, b) => {
        const da = sessionDateById.get(a.session_id) ?? "";
        const db = sessionDateById.get(b.session_id) ?? "";
        return da < db ? -1 : da > db ? 1 : 0;
      })
      .map((s) => s.id);

    const members: MemberAttendanceTimeline[] = g.group_members.map((m) => {
      const statuses = orderedSheetIds
        .map((sheetId) => recordRows.find((r) => r.attendance_sheet_id === sheetId && r.profile_id === m.profile_id)?.status)
        .filter((s): s is "present" | "excused_absence" | "unexcused_absence" => !!s && s !== "not_recorded");
      return { profileId: m.profile_id, displayName: m.profiles?.display_name ?? "—", statuses };
    });

    const overdueGroupAssignmentCount = overdueGroupAssignmentCounts.get(g.id) ?? 0;
    const { health, reasons } = deriveGroupHealthFromMembers(members, missingSheetsCount, overdueGroupAssignmentCount);
    return { id: g.id, name: g.name, memberCount: g.group_members.length, health, reasons, missingSheetsCount };
  });
}

/**
 * Sponsor path (section 4.3/9.2) — same rules as getGroupsWithHealth
 * above, but backed by program_group_health_signals(), a SECURITY
 * DEFINER RPC that returns COUNTS ONLY (no student identity), since
 * Sponsor has no RLS row access to attendance_sheets/attendance_records
 * at all (0002_rls.sql). Reasons read generically ("2 học viên…")
 * instead of by name.
 */
interface HealthSignalRow {
  group_id: string;
  ineligible_count: number;
  near_threshold_count: number;
  consecutive_count: number;
  missing_sheets_count: number;
}

interface OverdueAssignmentSignalRow {
  group_id: string;
  overdue_count: number;
}

export async function getGroupsWithHealthAggregate(programId: string): Promise<GroupHealthInfo[]> {
  const supabase = await createClient();

  const [{ data: groups }, { data: signalsRaw }, { data: overdueRaw }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, group_members(profile_id)")
      .eq("program_id", programId)
      .order("name"),
    supabase.rpc("program_group_health_signals", { p_program_id: programId }),
    supabase.rpc("program_group_overdue_assignments", { p_program_id: programId }),
  ]);
  const signals = (signalsRaw ?? []) as HealthSignalRow[];
  const overdueSignals = (overdueRaw ?? []) as OverdueAssignmentSignalRow[];

  const signalByGroup = new Map(signals.map((s) => [s.group_id, s]));
  const overdueByGroup = new Map(overdueSignals.map((s) => [s.group_id, s.overdue_count]));

  return (groups ?? []).map((g) => {
    const signal = signalByGroup.get(g.id);
    // "Cần chú ý" khi vắng ≥3 buổi (mục 11.3/MAX_ALLOWED_ABSENCES) —
    // RPC vẫn tách near_threshold (đúng 3) và ineligible (≥4) thành 2
    // cột riêng (không sửa RPC cũ), cộng lại ở đây là đủ vì 2 tập này
    // không giao nhau (đúng 3 vs ≥4). `consecutive_count` không còn
    // dùng — rule "vắng 2 buổi liên tiếp" đã bị thay bằng ngưỡng tổng
    // số buổi vắng ≥3 (xem lib/attendance/health.ts).
    const attentionMemberCount = (signal?.near_threshold_count ?? 0) + (signal?.ineligible_count ?? 0);
    const { health, reasons } = computeGroupHealth({
      overdueGroupAssignmentCount: overdueByGroup.get(g.id) ?? 0,
      attentionMemberCount,
      missingSheetsCount: signal?.missing_sheets_count ?? 0,
    });
    return {
      id: g.id,
      name: g.name,
      memberCount: g.group_members.length,
      health,
      reasons,
      missingSheetsCount: signal?.missing_sheets_count ?? 0,
    };
  });
}

// ---------------------------------------------------------------------
// /app/attendance overview table — Owner/Co-owner, Trainer, Mentor.
// ---------------------------------------------------------------------

export interface AttendanceOverviewRow {
  sessionId: string;
  sessionDate: string;
  groupId: string;
  groupName: string;
  sheetId: string | null;
  sheetStatus: "missing" | "open" | "submitted" | "locked" | "reopened";
}

export async function getAttendanceOverviewRows(programId: string): Promise<AttendanceOverviewRow[]> {
  const supabase = await createClient();
  const [{ data: sessions }, { data: groups }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, session_date")
      .eq("program_id", programId)
      .in("status", ["attendance_open", "completed"])
      .order("session_date", { ascending: true }),
    supabase.from("groups").select("id, name").eq("program_id", programId).order("name"),
  ]);
  const sessionRows = sessions ?? [];
  const groupRows = groups ?? [];
  if (sessionRows.length === 0 || groupRows.length === 0) return [];

  const sessionIds = sessionRows.map((s) => s.id);
  const { data: sheets } = await supabase
    .from("attendance_sheets")
    .select("id, session_id, group_id, status")
    .in("session_id", sessionIds);
  const sheetByKey = new Map((sheets ?? []).map((s) => [`${s.session_id}:${s.group_id}`, s]));

  const rows: AttendanceOverviewRow[] = [];
  for (const session of sessionRows) {
    for (const group of groupRows) {
      const sheet = sheetByKey.get(`${session.id}:${group.id}`);
      rows.push({
        sessionId: session.id,
        sessionDate: session.session_date,
        groupId: group.id,
        groupName: group.name,
        sheetId: sheet?.id ?? null,
        sheetStatus: (sheet?.status as AttendanceOverviewRow["sheetStatus"]) ?? "missing",
      });
    }
  }
  return rows;
}

export async function getMentorGroupIds(profileId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("mentor_assignments").select("group_id").eq("profile_id", profileId);
  return (data ?? []).map((r) => r.group_id);
}

export async function getStudentGroupId(profileId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  return data?.group_id ?? null;
}
