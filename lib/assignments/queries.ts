import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth/current-user";
import { getMentorGroupIds, getStudentGroupId } from "@/lib/attendance/queries";
import type { AssignmentStatus, SubmissionStatus } from "@/lib/constants/statuses";

// ---------------------------------------------------------------------
// Course Assignment list — section 12.1, "Bài tập" nav scope (6.2):
// Owner/Co-owner see everything; Trainer sees "Own" (created by them);
// Mentors/Student see "Own group"/"Own" (targeted at their group, at
// them individually, or at the whole program). assignments_select RLS
// (0002_rls.sql) already grants row access to any active non-Sponsor
// member for every assignment in the program — this filter is the UX
// scoping from section 6.2, applied in app code the same way
// getAttendanceOverviewRows' callers filter a broader RLS-permitted
// read down to "own group" (lib/attendance/queries.ts).
// ---------------------------------------------------------------------

export interface AssignmentListItem {
  id: string;
  title: string;
  status: AssignmentStatus;
  dueAt: string | null;
  submissionMode: "individual" | "group";
  createdBy: string;
  createdByName: string;
  sessionLabel: string | null;
  targetSummary: string;
  /**
   * "group" (target=program hoặc target=group, ai trong nhóm cũng xem
   * được) vs "individual" (có ít nhất 1 target=profile — chỉ đúng
   * người/những người được giao mới xem/nộp được). Dùng để tách 2
   * card "Bài tập nhóm" / "Bài tập cá nhân" ở Group Workspace.
   */
  scope: "group" | "individual";
}

interface AssignmentRow {
  id: string;
  title: string;
  status: AssignmentStatus;
  due_at: string | null;
  submission_mode: "individual" | "group";
  created_by: string;
  creator: { display_name: string } | null;
  session: { session_date: string } | null;
  assignment_targets: {
    target_type: "program" | "group" | "profile";
    group_id: string | null;
    profile_id: string | null;
    groups: { name: string } | null;
  }[];
}

const ASSIGNMENT_SELECT =
  "id, title, status, due_at, submission_mode, created_by, creator:profiles(display_name), session:sessions(session_date), assignment_targets(target_type, group_id, profile_id, groups(name))";

function computeScope(targets: AssignmentRow["assignment_targets"]): "group" | "individual" {
  return targets.some((t) => t.target_type === "profile") ? "individual" : "group";
}

function summarizeTargets(targets: AssignmentRow["assignment_targets"]): string {
  if (targets.some((t) => t.target_type === "program")) return "Toàn lớp";
  const groupNames = targets
    .filter((t) => t.target_type === "group")
    .map((t) => t.groups?.name)
    .filter((n): n is string => !!n);
  if (groupNames.length > 0) return groupNames.join(", ");
  const profileCount = targets.filter((t) => t.target_type === "profile").length;
  if (profileCount > 0) return `${profileCount} sinh viên`;
  return "Chưa chọn đối tượng";
}

function isVisibleToViewer(
  row: AssignmentRow,
  user: AppUser,
  viewerGroupIds: string[]
): boolean {
  if (user.role === "owner" || user.role === "co_owner") return true;
  if (user.role === "trainer") return row.created_by === user.id;
  return row.assignment_targets.some((t) => {
    if (t.target_type === "program") return true;
    if (t.target_type === "group") return t.group_id !== null && viewerGroupIds.includes(t.group_id);
    if (t.target_type === "profile") return t.profile_id === user.id;
    return false;
  });
}

async function getViewerGroupIds(user: AppUser): Promise<string[]> {
  if (user.role === "mentor_zps" || user.role === "mentor_student") {
    return getMentorGroupIds(user.id);
  }
  if (user.role === "student") {
    const groupId = await getStudentGroupId(user.id);
    return groupId ? [groupId] : [];
  }
  return [];
}

export async function getAssignmentsForUser(user: AppUser): Promise<AssignmentListItem[]> {
  const supabase = await createClient();
  const [{ data }, viewerGroupIds] = await Promise.all([
    supabase
      .from("assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("program_id", user.programId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .returns<AssignmentRow[]>(),
    getViewerGroupIds(user),
  ]);

  const rows = (data ?? []).filter((r) => isVisibleToViewer(r, user, viewerGroupIds));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    dueAt: r.due_at,
    submissionMode: r.submission_mode,
    createdBy: r.created_by,
    createdByName: r.creator?.display_name ?? "—",
    sessionLabel: r.session?.session_date ?? null,
    targetSummary: summarizeTargets(r.assignment_targets),
    scope: computeScope(r.assignment_targets),
  }));
}

export interface AssignmentMeta {
  id: string;
  title: string;
  description: string | null;
  status: AssignmentStatus;
  dueAt: string | null;
  submissionMode: "individual" | "group";
  createdBy: string;
  createdByName: string;
  sessionId: string | null;
  sessionLabel: string | null;
  targets: { type: "program" | "group" | "profile"; label: string }[];
}

export async function getAssignmentMeta(assignmentId: string): Promise<AssignmentMeta | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select(
      "id, title, description, status, due_at, submission_mode, created_by, session_id, creator:profiles(display_name), session:sessions(session_date), assignment_targets(target_type, group_id, profile_id, groups(name), target_profile:profiles(display_name))"
    )
    .eq("id", assignmentId)
    .maybeSingle<{
      id: string;
      title: string;
      description: string | null;
      status: AssignmentStatus;
      due_at: string | null;
      submission_mode: "individual" | "group";
      created_by: string;
      session_id: string | null;
      creator: { display_name: string } | null;
      session: { session_date: string } | null;
      assignment_targets: {
        target_type: "program" | "group" | "profile";
        group_id: string | null;
        profile_id: string | null;
        groups: { name: string } | null;
        target_profile: { display_name: string } | null;
      }[];
    }>();
  if (!data) return null;

  const targets = data.assignment_targets.map((t) => ({
    type: t.target_type,
    label:
      t.target_type === "program"
        ? "Toàn lớp"
        : t.target_type === "group"
          ? (t.groups?.name ?? "—")
          : (t.target_profile?.display_name ?? "—"),
  }));

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    status: data.status,
    dueAt: data.due_at,
    submissionMode: data.submission_mode,
    createdBy: data.created_by,
    createdByName: data.creator?.display_name ?? "—",
    sessionId: data.session_id,
    sessionLabel: data.session?.session_date ?? null,
    targets,
  };
}

// ---------------------------------------------------------------------
// Home "Deadline sắp tới" widget (section 9.1/9.3/9.4/9.5/9.6) — real
// Course Assignment due_at data (scoped like the list above). Sponsor
// is excluded (not in role list) same as the "Bài tập" nav item.
//
// README flagged deviation (theo yêu cầu của bạn): trước đây widget
// này gộp cả Mentor Task due_at — Mentor Task (Nhiệm vụ) đã bị bỏ hẳn
// khỏi app (code + schema), nên giờ chỉ còn deadline Course Assignment.
// ---------------------------------------------------------------------

export interface DeadlineItem {
  id: string;
  title: string;
  scope: string;
  dueAt: string;
}

const DEADLINE_HORIZON_LIMIT = 6;

export async function getUpcomingDeadlines(user: AppUser): Promise<DeadlineItem[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const viewerGroupIds = await getViewerGroupIds(user);

  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("program_id", user.programId)
    .not("due_at", "is", null)
    .gte("due_at", nowIso)
    .eq("status", "in_progress")
    .order("due_at", { ascending: true })
    .returns<AssignmentRow[]>();

  return (assignmentRows ?? [])
    .filter((r) => isVisibleToViewer(r, user, viewerGroupIds))
    .map((r) => ({
      id: r.id,
      title: r.title,
      scope: summarizeTargets(r.assignment_targets),
      dueAt: r.due_at as string,
    }))
    .slice(0, DEADLINE_HORIZON_LIMIT);
}

// ---------------------------------------------------------------------
// Trainer Home "Submission queue" (section 9.3) — locked submissions
// (section 12.3 "Lock the submitted version") awaiting review, scoped
// to assignments this Trainer created. RLS already scopes submissions
// to what the caller may see; the assignment_id filter narrows it to
// "own", matching "Own assignment" in the permission matrix (4.2).
// ---------------------------------------------------------------------

export interface ReviewQueueItem {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  ownerLabel: string;
}

export async function getTrainerReviewQueue(trainerId: string, programId: string): Promise<ReviewQueueItem[]> {
  const supabase = await createClient();
  const { data: ownAssignments } = await supabase
    .from("assignments")
    .select("id, title")
    .eq("program_id", programId)
    .eq("created_by", trainerId);
  const assignmentIds = (ownAssignments ?? []).map((a) => a.id);
  if (assignmentIds.length === 0) return [];
  const titleById = new Map((ownAssignments ?? []).map((a) => [a.id, a.title]));

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, assignment_id, group_id, profile_id, groups(name), profiles(display_name)")
    .in("assignment_id", assignmentIds)
    .eq("status", "locked")
    .returns<
      {
        id: string;
        assignment_id: string;
        group_id: string | null;
        profile_id: string | null;
        groups: { name: string } | null;
        profiles: { display_name: string } | null;
      }[]
    >();

  return (submissions ?? []).map((s) => ({
    submissionId: s.id,
    assignmentId: s.assignment_id,
    assignmentTitle: titleById.get(s.assignment_id) ?? "—",
    ownerLabel: s.groups?.name ?? s.profiles?.display_name ?? "—",
  }));
}


// ---------------------------------------------------------------------
// Create-assignment / Create-mentor-task form data — groups, students,
// group members. Plain program-wide reads (RLS: groups_select/
// program_memberships_select already scope these to active members of
// the caller's own program).
// ---------------------------------------------------------------------

export interface GroupOption {
  id: string;
  name: string;
}

export async function getProgramGroups(programId: string): Promise<GroupOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("groups").select("id, name").eq("program_id", programId).order("name");
  return data ?? [];
}

export interface StudentOption {
  id: string;
  name: string;
  groupName: string | null;
}

export async function getProgramStudents(programId: string): Promise<StudentOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_memberships")
    .select("profile_id, profiles(display_name)")
    .eq("program_id", programId)
    .eq("role", "student")
    .eq("status", "active")
    .returns<{ profile_id: string; profiles: { display_name: string } | null }[]>();

  const students = data ?? [];
  if (students.length === 0) return [];

  const { data: memberships } = await supabase
    .from("group_members")
    .select("profile_id, groups(name)")
    .in(
      "profile_id",
      students.map((s) => s.profile_id)
    )
    .returns<{ profile_id: string; groups: { name: string } | null }[]>();
  const groupNameByProfile = new Map((memberships ?? []).map((m) => [m.profile_id, m.groups?.name ?? null]));

  return students.map((s) => ({
    id: s.profile_id,
    name: s.profiles?.display_name ?? "—",
    groupName: groupNameByProfile.get(s.profile_id) ?? null,
  }));
}

// ---------------------------------------------------------------------
// Assignment detail page — full submission list with version history.
// RLS (submissions_select/submission_versions_select/
// submission_assets_select, 0002_rls.sql) already scopes the returned
// rows correctly for every role (creator/Owner/Co-owner see everyone's;
// a group mentor sees their group's; a student/group sees only their
// own) — no extra app-level filtering needed here, unlike the
// assignments list above (whose RLS is intentionally broader, "not
// Sponsor" only).
// ---------------------------------------------------------------------


export interface SubmissionVersionRecord {
  id: string;
  versionNumber: number;
  note: string | null;
  createdAt: string;
  createdByName: string;
  assets: { assetType: string; url: string | null }[];
}

export interface SubmissionWithHistory {
  id: string;
  ownerType: "group" | "profile";
  ownerId: string;
  ownerLabel: string;
  status: SubmissionStatus;
  /** Descending by versionNumber — versions[0] is the latest. */
  versions: SubmissionVersionRecord[];
}

export async function getSubmissionsForAssignment(assignmentId: string): Promise<SubmissionWithHistory[]> {
  const supabase = await createClient();
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, group_id, profile_id, status, groups(name), profiles(display_name)")
    .eq("assignment_id", assignmentId)
    .returns<
      {
        id: string;
        group_id: string | null;
        profile_id: string | null;
        status: SubmissionStatus;
        groups: { name: string } | null;
        profiles: { display_name: string } | null;
      }[]
    >();

  const subRows = submissions ?? [];
  if (subRows.length === 0) return [];

  const subIds = subRows.map((s) => s.id);
  const { data: versions } = await supabase
    .from("submission_versions")
    .select("id, submission_id, version_number, note, created_at, profiles(display_name)")
    .in("submission_id", subIds)
    .order("version_number", { ascending: false })
    .returns<
      {
        id: string;
        submission_id: string;
        version_number: number;
        note: string | null;
        created_at: string;
        profiles: { display_name: string } | null;
      }[]
    >();
  const versionRows = versions ?? [];

  const versionIds = versionRows.map((v) => v.id);
  const { data: assets } = versionIds.length
    ? await supabase
        .from("submission_assets")
        .select("submission_version_id, asset_type, url")
        .in("submission_version_id", versionIds)
        .returns<{ submission_version_id: string; asset_type: string; url: string | null }[]>()
    : { data: [] as { submission_version_id: string; asset_type: string; url: string | null }[] };
  const assetRows = assets ?? [];

  return subRows.map((s) => ({
    id: s.id,
    ownerType: s.group_id ? ("group" as const) : ("profile" as const),
    ownerId: (s.group_id ?? s.profile_id) as string,
    ownerLabel: s.groups?.name ?? s.profiles?.display_name ?? "—",
    status: s.status,
    versions: versionRows
      .filter((v) => v.submission_id === s.id)
      .map((v) => ({
        id: v.id,
        versionNumber: v.version_number,
        note: v.note,
        createdAt: v.created_at,
        createdByName: v.profiles?.display_name ?? "—",
        assets: assetRows
          .filter((a) => a.submission_version_id === v.id)
          .map((a) => ({ assetType: a.asset_type, url: a.url })),
      })),
  }));
}

// ---------------------------------------------------------------------
// Owner/Co-owner Home "Action Center" (section 9.1) — the doc lists the
// widget by name without acceptance-criteria bullets (unlike group
// health's detailed section 17). README flagged deviation (theo yêu
// cầu của bạn): "Mentor Task quá hạn" signal bỏ luôn cùng đợt xoá tính
// năng Nhiệm vụ — chỉ còn 1 signal: submissions waiting on a review
// decision.
// ---------------------------------------------------------------------

export interface OwnerActionSignals {
  pendingReviewCount: number;
}

export async function getOwnerActionSignals(programId: string): Promise<OwnerActionSignals> {
  const supabase = await createClient();

  const { data: assignmentIdsRaw } = await supabase.from("assignments").select("id").eq("program_id", programId);
  const assignmentIds = (assignmentIdsRaw ?? []).map((a) => a.id);

  const { count: pendingReviewCount } =
    assignmentIds.length > 0
      ? await supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .in("assignment_id", assignmentIds)
          .eq("status", "locked")
      : { count: 0 };

  return {
    pendingReviewCount: pendingReviewCount ?? 0,
  };
}

// ---------------------------------------------------------------------
// Group Workspace "Bài tập" tab (section 13.3) — Course Assignments and
// Mentor Tasks scoped to ONE group, read via the viewer's own
// RLS-scoped client (so a Trainer/Sponsor opening someone else's
// workspace still only sees what RLS actually grants them — e.g.
// Sponsor gets zero rows here, matching assignments_select's "not
// visible to Sponsor").
// ---------------------------------------------------------------------

export async function getAssignmentsForGroup(
  programId: string,
  groupId: string,
  viewer: AppUser
): Promise<AssignmentListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("program_id", programId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .returns<AssignmentRow[]>();

  // README flagged deviation — trước đây ẩn hẳn Bài tập giao riêng
  // từng cá nhân khỏi tab này. Theo yêu cầu của bạn: hiện luôn cả Bài
  // tập cá nhân TẠI ĐÂY, nhưng chỉ đúng người được giao mới xem/nộp
  // được — dùng cùng quy tắc hiển thị với isVisibleToViewer (viewer
  // Owner/Co-owner thấy hết để quản lý; Trainer thấy bài mình tạo;
  // Mentor/Student/Sponsor chỉ thấy target=program, target=group của
  // chính nhóm này, hoặc target=profile đúng bằng chính mình).
  const canSeeAllIndividual = viewer.role === "owner" || viewer.role === "co_owner";
  const rows = (data ?? []).filter((r) =>
    r.assignment_targets.some((t) => {
      if (t.target_type === "program") return true;
      if (t.target_type === "group") return t.group_id === groupId;
      if (t.target_type === "profile") {
        if (canSeeAllIndividual) return true;
        if (viewer.role === "trainer") return r.created_by === viewer.id;
        return t.profile_id === viewer.id;
      }
      return false;
    })
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    dueAt: r.due_at,
    submissionMode: r.submission_mode,
    createdBy: r.created_by,
    createdByName: r.creator?.display_name ?? "—",
    sessionLabel: r.session?.session_date ?? null,
    targetSummary: summarizeTargets(r.assignment_targets),
    scope: computeScope(r.assignment_targets),
  }));
}

/**
 * Group Workspace summary metric "Group assignments completed / total"
 * (section 13.2) — assignment-level like the Sponsor RPC (see
 * 0007_assignment_sponsor_rpc.sql), counting only assignments actually
 * targeted at this group (whole-program or this specific group).
 * Returns zero for Sponsor callers (assignments_select denies them
 * entirely) — expected, matches "Bài tập" being hidden from Sponsor
 * everywhere else in the app too.
 */
export async function getGroupAssignmentCompletion(
  programId: string,
  groupId: string
): Promise<{ total: number; completed: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("program_id", programId)
    .returns<AssignmentRow[]>();

  // Cố ý KHÔNG dùng getAssignmentsForGroup ở đây — chỉ số "nhóm" này
  // (section 13.2) chỉ tính Bài tập target toàn chương trình hoặc
  // đúng nhóm này; Bài tập cá nhân (target=profile) không thuộc về
  // "cả nhóm" nên không tính vào đây, tránh làm sai lệch chỉ số hoàn
  // thành của nhóm. Không còn "draft"/"archived" để loại trừ (rút gọn
  // AssignmentStatus — xem lib/constants/statuses.ts) nên "active" giờ
  // là toàn bộ rows.
  const rows = (data ?? []).filter((r) =>
    r.assignment_targets.some((t) => t.target_type === "program" || (t.target_type === "group" && t.group_id === groupId))
  );
  return { total: rows.length, completed: rows.filter((r) => r.status === "completed").length };
}

