import { createClient } from "@/lib/supabase/server";
import { MAX_ALLOWED_ABSENCES } from "@/lib/attendance/health";
import { getAssignmentsForGroup } from "@/lib/assignments/queries";
import type {
  AttendanceStatus,
  SessionStatus,
  ProjectMilestoneStage,
  ProjectMilestoneStatus,
  ProjectChecklistItemStatus,
} from "@/lib/constants/statuses";

// ---------------------------------------------------------------------
// Header (section 13.1) — group identity + mentors. Group health and
// "current milestone" are read separately: health reuses
// lib/attendance/queries.ts's getGroupsWithHealth/
// getGroupsWithHealthAggregate (same Sponsor-vs-everyone-else branch as
// Home, see the page) rather than being duplicated here.
// ---------------------------------------------------------------------

export interface GroupBasicInfo {
  id: string;
  name: string;
  imageUrl: string | null;
  memberCount: number;
  mentorZpsName: string | null;
  mentorStudentName: string | null;
  updatedAt: string;
  lastUpdatedByName: string | null;
}

export async function getGroupBasicInfo(groupId: string): Promise<GroupBasicInfo | null> {
  const supabase = await createClient();
  const [{ data: group }, { data: mentors }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, image_url, updated_at, last_updated_by, group_members(profile_id)")
      .eq("id", groupId)
      .maybeSingle<{
        id: string;
        name: string;
        image_url: string | null;
        updated_at: string;
        last_updated_by: string | null;
        group_members: { profile_id: string }[];
      }>(),
    supabase
      .from("mentor_assignments")
      .select("mentor_type, profiles(display_name)")
      .eq("group_id", groupId)
      .returns<{ mentor_type: string; profiles: { display_name: string } | null }[]>(),
  ]);
  if (!group) return null;

  // last_updated_by → display name via a separate lookup, same reason
  // as attendance_sheets.submitted_by/reopened_by (Phase 6) — no embed
  // guess-the-constraint-name needed for a single plain FK either, but
  // consistent with the rest of the codebase's convention.
  let lastUpdatedByName: string | null = null;
  if (group.last_updated_by) {
    const { data: editor } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", group.last_updated_by)
      .maybeSingle();
    lastUpdatedByName = editor?.display_name ?? null;
  }

  const mentorRows = mentors ?? [];
  return {
    id: group.id,
    name: group.name,
    imageUrl: group.image_url,
    memberCount: group.group_members.length,
    mentorZpsName: mentorRows.find((m) => m.mentor_type === "mentor_zps")?.profiles?.display_name ?? null,
    mentorStudentName: mentorRows.find((m) => m.mentor_type === "mentor_student")?.profiles?.display_name ?? null,
    updatedAt: group.updated_at,
    lastUpdatedByName,
  };
}

// ---------------------------------------------------------------------
// "Thành viên" tab (section 13.3) — per-member attendance rate.
// README flagged deviation (theo yêu cầu của bạn): cột "Vai trò dự
// án" đã bỏ khỏi tab này và khỏi tab Dự án cuối khoá luôn (bảng
// `project_members`/cột `role_in_project` vẫn còn trong schema, không
// xoá, chỉ không còn UI đọc/sửa). Cột "Tiến độ task" (dựa trên Nhiệm
// vụ/Mentor Task) cũng đã bỏ cùng đợt xoá hẳn tính năng Nhiệm vụ khỏi
// app (code + schema) — không còn nguồn dữ liệu "task" nào để hiện.
// ---------------------------------------------------------------------

export interface GroupMemberDetail {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  attended: number;
  absences: number;
  /** Section 11.3 "Required count" — tổng số buổi học trong Thời khóa
   *  biểu của cả chương trình (không phải số buổi đã điểm danh). */
  totalSessions: number;
  eligible: boolean;
}

export async function getGroupMembersDetail(groupId: string): Promise<GroupMemberDetail[]> {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("group_members")
    .select("profile_id, profiles(display_name, avatar_url)")
    .eq("group_id", groupId)
    .returns<{ profile_id: string; profiles: { display_name: string; avatar_url: string | null } | null }[]>();
  const memberRows = members ?? [];
  if (memberRows.length === 0) return [];
  const profileIds = memberRows.map((m) => m.profile_id);

  const { data: group } = await supabase
    .from("groups")
    .select("program_id")
    .eq("id", groupId)
    .maybeSingle();

  const [{ data: records }, { count: totalSessions }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("profile_id, status, attendance_sheets!inner(group_id)")
      .eq("attendance_sheets.group_id", groupId)
      .neq("status", "not_recorded")
      .in("profile_id", profileIds)
      .returns<{ profile_id: string; status: string }[]>(),
    // Section 11.3 "Required count" — tổng số buổi trong Thời khóa biểu
    // của cả chương trình, cùng cách tính với getProgramSessionStats
    // (lib/schedule/queries.ts) — không lọc theo status. `sessions`
    // không có group_id (buổi học dùng chung cho toàn chương trình),
    // nên phải lookup program_id của nhóm rồi đếm theo program_id.
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("program_id", group?.program_id ?? ""),
  ]);

  const recordRows = records ?? [];

  return memberRows.map((m) => {
    const myRecords = recordRows.filter((r) => r.profile_id === m.profile_id);
    const attended = myRecords.filter((r) => r.status === "present").length;
    const absences = myRecords.length - attended;
    return {
      profileId: m.profile_id,
      displayName: m.profiles?.display_name ?? "—",
      avatarUrl: m.profiles?.avatar_url ?? null,
      attended,
      absences,
      totalSessions: totalSessions ?? 0,
      eligible: absences <= MAX_ALLOWED_ABSENCES,
    };
  });
}

// ---------------------------------------------------------------------
// "Thời khóa biểu" tab — the full program-wide 16-day schedule (same
// for every group), annotated with this group's related assignments
// and the post-completion survey CTA (section 15).
// ---------------------------------------------------------------------

export interface GroupScheduleRow {
  sessionId: string;
  sessionDate: string;
  status: SessionStatus;
  blocks: string[];
  trainerNames: string[];
  relatedAssignmentTitles: string[];
  surveyUrl: string | null;
}

export async function getGroupScheduleRows(programId: string, groupId: string): Promise<GroupScheduleRow[]> {
  const supabase = await createClient();
  const [{ data: sessions }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, session_date, status, survey_url, trainer_profile_ids, session_blocks(title, sort_order)")
      .eq("program_id", programId)
      .order("session_date", { ascending: true })
      .returns<
        {
          id: string;
          session_date: string;
          status: SessionStatus;
          survey_url: string | null;
          trainer_profile_ids: string[];
          session_blocks: { title: string; sort_order: number }[];
        }[]
      >(),
    supabase
      .from("assignments")
      .select("id, title, session_id, assignment_targets(target_type, group_id)")
      .eq("program_id", programId)
      .not("session_id", "is", null)
      .returns<
        { id: string; title: string; session_id: string; assignment_targets: { target_type: string; group_id: string | null }[] }[]
      >(),
  ]);

  const sessionRows = sessions ?? [];
  const relevantAssignments = (assignmentRows ?? []).filter((a) =>
    a.assignment_targets.some((t) => t.target_type === "program" || (t.target_type === "group" && t.group_id === groupId))
  );
  const assignmentTitlesBySession = new Map<string, string[]>();
  for (const a of relevantAssignments) {
    const list = assignmentTitlesBySession.get(a.session_id) ?? [];
    list.push(a.title);
    assignmentTitlesBySession.set(a.session_id, list);
  }

  const allTrainerIds = [...new Set(sessionRows.flatMap((s) => s.trainer_profile_ids))];
  const { data: trainerProfiles } = allTrainerIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", allTrainerIds)
    : { data: [] as { id: string; display_name: string }[] };
  const trainerNameById = new Map((trainerProfiles ?? []).map((p) => [p.id, p.display_name]));

  return sessionRows.map((s) => ({
    sessionId: s.id,
    sessionDate: s.session_date,
    status: s.status,
    blocks: [...s.session_blocks].sort((a, b) => a.sort_order - b.sort_order).map((b) => b.title),
    trainerNames: s.trainer_profile_ids.map((id) => trainerNameById.get(id)).filter((n): n is string => !!n),
    relatedAssignmentTitles: assignmentTitlesBySession.get(s.id) ?? [],
    surveyUrl: s.status === "completed" ? s.survey_url : null,
  }));
}

// ---------------------------------------------------------------------
// "Attendance" tab — member × session matrix (section 13.3). Read-only
// here; actual fill-in/lock/reopen stays on the already-built
// /app/attendance/[sessionId]/[groupId] page (linked from the matrix)
// rather than being duplicated — same reuse-not-rebuild choice made for
// the Schedule/Bài tập tabs.
// ---------------------------------------------------------------------

export interface GroupAttendanceMatrix {
  sessions: { id: string; sessionDate: string; sheetStatus: "missing" | "open" | "submitted" | "locked" | "reopened" }[];
  members: { profileId: string; displayName: string }[];
  cellStatus: Record<string, AttendanceStatus>;
}

export async function getGroupAttendanceMatrix(programId: string, groupId: string): Promise<GroupAttendanceMatrix> {
  const supabase = await createClient();
  const [{ data: sessions }, { data: members }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, session_date")
      .eq("program_id", programId)
      .in("status", ["attendance_open", "completed"])
      .order("session_date", { ascending: true }),
    supabase
      .from("group_members")
      .select("profile_id, profiles(display_name)")
      .eq("group_id", groupId)
      .returns<{ profile_id: string; profiles: { display_name: string } | null }[]>(),
  ]);
  const sessionRows = sessions ?? [];
  const memberRows = members ?? [];
  const sessionIds = sessionRows.map((s) => s.id);

  const { data: sheets } = sessionIds.length
    ? await supabase
        .from("attendance_sheets")
        .select("id, session_id, status")
        .eq("group_id", groupId)
        .in("session_id", sessionIds)
        .returns<{ id: string; session_id: string; status: string }[]>()
    : { data: [] as { id: string; session_id: string; status: string }[] };
  const sheetRows = sheets ?? [];
  const sheetBySession = new Map(sheetRows.map((s) => [s.session_id, s]));

  const finalizedSheetIds = sheetRows.filter((s) => s.status === "locked" || s.status === "reopened").map((s) => s.id);
  const { data: records } = finalizedSheetIds.length
    ? await supabase
        .from("attendance_records")
        .select("attendance_sheet_id, profile_id, status")
        .in("attendance_sheet_id", finalizedSheetIds)
        .returns<{ attendance_sheet_id: string; profile_id: string; status: string }[]>()
    : { data: [] as { attendance_sheet_id: string; profile_id: string; status: string }[] };
  const recordRows = records ?? [];

  const cellStatus: Record<string, AttendanceStatus> = {};
  for (const r of recordRows) {
    const sheet = sheetRows.find((s) => s.id === r.attendance_sheet_id);
    if (!sheet) continue;
    cellStatus[`${sheet.session_id}:${r.profile_id}`] = r.status as AttendanceStatus;
  }

  return {
    sessions: sessionRows.map((s) => ({
      id: s.id,
      sessionDate: s.session_date,
      sheetStatus: (sheetBySession.get(s.id)?.status as GroupAttendanceMatrix["sessions"][number]["sheetStatus"]) ?? "missing",
    })),
    members: memberRows.map((m) => ({ profileId: m.profile_id, displayName: m.profiles?.display_name ?? "—" })),
    cellStatus,
  };
}

// ---------------------------------------------------------------------
// "Final Project" tab (section 13.3/14) — group_projects is seeded
// 1:1 per group (supabase/seed.sql), so this is always a lookup, never
// a "create" case. Rewritten (theo yêu cầu của bạn) into 3 subtabs:
// Tiến độ dự án (hành trình 8 giai đoạn cố định, thay "milestone" tự
// do cũ), Build và tài liệu (project_builds, versioned — thay hẳn
// project_submissions "Bài nộp dự án"), Checklist
// (project_checklist_status — mục cố định định nghĩa ở
// lib/constants/statuses.ts, DB chỉ lưu trạng thái).
// ---------------------------------------------------------------------

export interface GroupProjectData {
  id: string;
  gameName: string | null;
  concept: string | null;
  imageUrl: string | null;
  updatedAt: string;
  lastUpdatedByName: string | null;
  milestoneStage: ProjectMilestoneStage;
  milestoneStatus: ProjectMilestoneStatus;
  milestoneNextGoal: string | null;
  milestoneDeadline: string | null;
  builds: {
    id: string;
    versionName: string;
    platform: string | null;
    buildUrl: string | null;
    repositoryUrl: string | null;
    installInstructions: string | null;
    knownIssues: string | null;
    releaseNotes: string | null;
    gddUrl: string | null;
    gameplayDemoUrl: string | null;
    screenshotUrls: string[];
    uploadedByName: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  checklist: Record<string, ProjectChecklistItemStatus>;
}

export async function getGroupProjectData(groupId: string): Promise<GroupProjectData | null> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("group_projects")
    .select(
      "id, game_name, concept, image_url, updated_at, last_updated_by, milestone_stage, milestone_status, milestone_next_goal, milestone_deadline"
    )
    .eq("group_id", groupId)
    .maybeSingle();
  if (!project) return null;

  const [{ data: builds }, { data: checklistRows }] = await Promise.all([
    supabase
      .from("project_builds")
      .select(
        "id, version_name, platform, build_url, repository_url, install_instructions, known_issues, release_notes, gdd_url, gameplay_demo_url, screenshot_urls, uploaded_by, created_at, updated_at"
      )
      .eq("group_project_id", project.id)
      .order("created_at", { ascending: false })
      .returns<
        {
          id: string;
          version_name: string;
          platform: string | null;
          build_url: string | null;
          repository_url: string | null;
          install_instructions: string | null;
          known_issues: string | null;
          release_notes: string | null;
          gdd_url: string | null;
          gameplay_demo_url: string | null;
          screenshot_urls: string[] | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        }[]
      >(),
    supabase
      .from("project_checklist_status")
      .select("item_key, status")
      .eq("group_project_id", project.id)
      .returns<{ item_key: string; status: ProjectChecklistItemStatus }[]>(),
  ]);

  // Names resolved via a separate lookup, not a PostgREST embed — same
  // "which FK constraint" ambiguity pattern as attendance_sheets.
  const editorIds = [project.last_updated_by, ...(builds ?? []).map((b) => b.uploaded_by)].filter(
    (id): id is string => !!id
  );
  let editorNames = new Map<string, string>();
  if (editorIds.length > 0) {
    const { data: editors } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", [...new Set(editorIds)]);
    editorNames = new Map((editors ?? []).map((e) => [e.id, e.display_name]));
  }

  const checklist: Record<string, ProjectChecklistItemStatus> = {};
  for (const row of checklistRows ?? []) {
    checklist[row.item_key] = row.status;
  }

  return {
    id: project.id,
    gameName: project.game_name,
    concept: project.concept,
    imageUrl: project.image_url,
    updatedAt: project.updated_at,
    lastUpdatedByName: project.last_updated_by ? editorNames.get(project.last_updated_by) ?? null : null,
    milestoneStage: project.milestone_stage as ProjectMilestoneStage,
    milestoneStatus: project.milestone_status as ProjectMilestoneStatus,
    milestoneNextGoal: project.milestone_next_goal,
    milestoneDeadline: project.milestone_deadline,
    builds: (builds ?? []).map((b) => ({
      id: b.id,
      versionName: b.version_name,
      platform: b.platform,
      buildUrl: b.build_url,
      repositoryUrl: b.repository_url,
      installInstructions: b.install_instructions,
      knownIssues: b.known_issues,
      releaseNotes: b.release_notes,
      gddUrl: b.gdd_url,
      gameplayDemoUrl: b.gameplay_demo_url,
      screenshotUrls: b.screenshot_urls ?? [],
      uploadedByName: b.uploaded_by ? editorNames.get(b.uploaded_by) ?? null : null,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    })),
    checklist,
  };
}

// Re-exported for convenience so pages doing a "Bài tập" tab only need
// to import from lib/groups/queries.
export { getAssignmentsForGroup };
