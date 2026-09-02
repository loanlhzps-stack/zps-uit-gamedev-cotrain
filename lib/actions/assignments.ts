"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { getStudentGroupId } from "@/lib/attendance/queries";
import { getAssignmentAccess, requireOwnerOrCo } from "@/lib/assignments/access";
import { ASSIGNMENT_STATUSES, SUBMISSION_ASSET_TYPES, type AssignmentStatus, type SubmissionAssetType } from "@/lib/constants/statuses";
import { createNotifications } from "@/lib/notifications/create";

export interface ActionResult {
  error?: string;
}

function parseDueAt(local: string): { ok: true; iso: string | null } | { ok: false; error: string } {
  if (!local) return { ok: true, iso: null };
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Deadline không hợp lệ." };
  return { ok: true, iso: d.toISOString() };
}

/**
 * Section 4.2 — "Create Course Assignment": Owner/Co-owner any scope,
 * Trainer "own teaching session" only (must be an assigned trainer on
 * the chosen session). Creates as 'in_progress' directly — đúng vòng
 * đời rút gọn (theo yêu cầu của bạn): "Đang làm" ngay khi giao, không
 * còn 'draft' để đi qua trước (xem lib/constants/statuses.ts).
 */
export async function createAssignment(formData: FormData): Promise<ActionResult> {
  const programId = String(formData.get("programId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dueAtLocal = String(formData.get("dueAt") ?? "").trim();
  const submissionMode = String(formData.get("submissionMode") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "").trim() || null;
  const targetType = String(formData.get("targetType") ?? "");
  const targetGroupIds = formData.getAll("targetGroupIds").map(String).filter(Boolean);
  const targetProfileIds = formData.getAll("targetProfileIds").map(String).filter(Boolean);

  if (!title) return { error: "Thiếu tiêu đề." };
  if (submissionMode !== "individual" && submissionMode !== "group") {
    return { error: "Hình thức nộp bài không hợp lệ." };
  }
  if (targetType !== "program" && targetType !== "group" && targetType !== "profile") {
    return { error: "Đối tượng không hợp lệ." };
  }
  if (targetType === "group" && targetGroupIds.length === 0) return { error: "Chọn ít nhất một nhóm." };
  if (targetType === "profile" && targetProfileIds.length === 0) return { error: "Chọn ít nhất một sinh viên." };

  const dueAt = parseDueAt(dueAtLocal);
  if (!dueAt.ok) return { error: dueAt.error };

  const result = await getCurrentAppUser();
  if (result.status !== "ok") return { error: "Chưa đăng nhập." };
  const { user } = result;
  if (user.programId !== programId) return { error: "Không tìm thấy chương trình." };

  const isOwnerOrCo = user.role === "owner" || user.role === "co_owner";
  if (!isOwnerOrCo && user.role !== "trainer") {
    return { error: "Bạn không có quyền tạo bài tập." };
  }

  const supabase = await createClient();

  if (user.role === "trainer") {
    if (!sessionId) return { error: "Trainer phải chọn buổi học mình phụ trách." };
    const { data: session } = await supabase
      .from("sessions")
      .select("id, program_id, trainer_profile_ids")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session || session.program_id !== programId || !(session.trainer_profile_ids as string[]).includes(user.id)) {
      return { error: "Bạn chỉ có thể tạo bài tập cho buổi học mình phụ trách." };
    }
  }

  const { data: assignment, error } = await supabase
    .from("assignments")
    .insert({
      program_id: programId,
      session_id: sessionId,
      created_by: user.id,
      title,
      description: description || null,
      due_at: dueAt.iso,
      submission_mode: submissionMode,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const targetRows: {
    assignment_id: string;
    target_type: "program" | "group" | "profile";
    group_id: string | null;
    profile_id: string | null;
  }[] =
    targetType === "program"
      ? [{ assignment_id: assignment.id, target_type: "program", group_id: null, profile_id: null }]
      : targetType === "group"
        ? targetGroupIds.map((id) => ({ assignment_id: assignment.id, target_type: "group", group_id: id, profile_id: null }))
        : targetProfileIds.map((id) => ({ assignment_id: assignment.id, target_type: "profile", group_id: null, profile_id: id }));

  const { error: targetError } = await supabase.from("assignment_targets").insert(targetRows);
  if (targetError) {
    return { error: `Đã tạo bài tập nhưng chưa gán được đối tượng: ${targetError.message}` };
  }

  revalidatePath("/app/assignments");
  revalidatePath("/app");
  redirect(`/app/assignments/${assignment.id}`);
}

/**
 * Editing targets after creation is intentionally out of scope for this
 * pass (README flagged deviation) — title/description/deadline/status
 * only. Re-create the assignment if the audience needs to change.
 */
export async function updateAssignmentMeta(assignmentId: string, formData: FormData): Promise<ActionResult> {
  const access = await getAssignmentAccess(assignmentId);
  if (!access.ok) return { error: access.error };
  if (!access.canEditMeta) return { error: "Bạn không có quyền sửa bài tập này." };
  const { supabase } = access;

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dueAtLocal = String(formData.get("dueAt") ?? "").trim();
  const status = String(formData.get("status") ?? "");

  if (!title) return { error: "Thiếu tiêu đề." };
  if (!ASSIGNMENT_STATUSES.includes(status as AssignmentStatus)) return { error: "Trạng thái không hợp lệ." };
  const dueAt = parseDueAt(dueAtLocal);
  if (!dueAt.ok) return { error: dueAt.error };

  const { error } = await supabase
    .from("assignments")
    .update({ title, description: description || null, due_at: dueAt.iso, status })
    .eq("id", assignmentId);
  if (error) return { error: error.message };

  revalidatePath(`/app/assignments/${assignmentId}`);
  revalidatePath("/app/assignments");
  revalidatePath("/app");
  return {};
}

export async function deleteAssignment(assignmentId: string, programId: string): Promise<ActionResult> {
  const guard = await requireOwnerOrCo(programId);
  if (!guard.ok) return { error: guard.error };

  const { error } = await guard.supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("program_id", programId);
  if (error) return { error: error.message };

  revalidatePath("/app/assignments");
  revalidatePath("/app");
  redirect("/app/assignments");
}

/**
 * Section 12.1 — "The owning Trainer reviews and sets `needs_revision`
 * or `completed`. ... Owner/Co-owner can override with an audit
 * reason." Only reviews a 'locked' submission (section 12.3 "Lock the
 * submitted version") unless it's an Owner/Co-owner override, which may
 * act on any status — same reopen-style escape hatch as
 * reopenAttendanceSheet (lib/actions/attendance.ts).
 */
export async function reviewSubmission(
  assignmentId: string,
  submissionId: string,
  decision: "needs_revision" | "completed",
  overrideReason?: string
): Promise<ActionResult> {
  const access = await getAssignmentAccess(assignmentId);
  if (!access.ok) return { error: access.error };
  if (!access.canReview) return { error: "Bạn không có quyền review bài tập này." };
  const { supabase, isOverrideReview, programId, user } = access;

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, assignment_id, status, profile_id, group_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission || submission.assignment_id !== assignmentId) return { error: "Không tìm thấy bài nộp." };
  if (submission.status !== "locked" && !isOverrideReview) {
    return { error: "Chỉ review được bài đã nộp (đã khoá)." };
  }

  let trimmedReason = "";
  if (isOverrideReview) {
    trimmedReason = (overrideReason ?? "").trim();
    if (trimmedReason.length < 5) {
      return { error: "Owner/Co-owner review thay Trainer cần nhập lý do (tối thiểu 5 ký tự)." };
    }
  }

  const { error } = await supabase.from("submissions").update({ status: decision }).eq("id", submissionId);
  if (error) return { error: error.message };

  if (isOverrideReview) {
    await supabase.from("audit_logs").insert({
      program_id: programId,
      actor_profile_id: user.id,
      action: "assignment_review_override",
      entity_type: "submission",
      entity_id: submissionId,
      reason: trimmedReason,
      metadata: { assignment_id: assignmentId, decision },
    });
  }

  // Section 16.1 — 'revision' notification to whoever needs to act
  // next. 'completed' has no matching enum value (see README flagged
  // deviation), so only the needs_revision path notifies.
  if (decision === "needs_revision") {
    let recipientIds: string[] = [];
    if (submission.profile_id) {
      recipientIds = [submission.profile_id];
    } else if (submission.group_id) {
      const { data: members } = await supabase.from("group_members").select("profile_id").eq("group_id", submission.group_id);
      recipientIds = (members ?? []).map((m) => m.profile_id);
    }
    const { data: assignmentRow } = await supabase.from("assignments").select("title").eq("id", assignmentId).maybeSingle();
    await createNotifications(supabase, {
      programId,
      recipientProfileIds: recipientIds,
      type: "revision",
      title: "Bài nộp cần chỉnh sửa lại",
      body: assignmentRow?.title ?? undefined,
      linkHref: `/app/assignments/${assignmentId}`,
      excludeProfileId: user.id,
    });
  }

  revalidatePath(`/app/assignments/${assignmentId}`);
  revalidatePath("/app/assignments");
  return {};
}

/**
 * Section 4.2 — "Submit personal/group work: Yes" is Student-only (an
 * individual submission_mode assignment) or a group's shared submission
 * (group mode, any student member — section 12.3 "All student members
 * ... may submit"). Mentors/Trainer/Owner never submit work themselves.
 */
async function getSubmitterContext(assignmentId: string) {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    return { ok: false as const, error: "Chưa đăng nhập." };
  }
  const { user } = result;
  if (user.role !== "student") {
    return { ok: false as const, error: "Chỉ sinh viên mới nộp bài." };
  }

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, program_id, submission_mode, status, title, created_by, assignment_targets(target_type, group_id, profile_id)")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment || assignment.program_id !== user.programId) {
    return { ok: false as const, error: "Không tìm thấy bài tập." };
  }

  // Bảo mật — trước đây chỗ này không kiểm tra assignment_targets, nên
  // về lý thuyết một sinh viên có thể nộp nhầm/cố ý vào bài giao RIÊNG
  // cho người khác (target=profile) nếu biết assignmentId. Giờ chặn
  // đúng theo đối tượng thật của bài (theo yêu cầu của bạn: "chỉ có
  // thành viên đó mới xem và submit được").
  const studentGroupId = await getStudentGroupId(user.id);
  const isTargeted = assignment.assignment_targets.some((t) => {
    if (t.target_type === "program") return true;
    if (t.target_type === "group") return studentGroupId !== null && t.group_id === studentGroupId;
    if (t.target_type === "profile") return t.profile_id === user.id;
    return false;
  });
  if (!isTargeted) {
    return { ok: false as const, error: "Bài tập này không giao cho bạn." };
  }

  let groupId: string | null = null;
  if (assignment.submission_mode === "group") {
    if (!studentGroupId) return { ok: false as const, error: "Bạn chưa thuộc nhóm nào." };
    groupId = studentGroupId;
  }

  return { ok: true as const, supabase, user, assignment, groupId };
}

/**
 * Section 12.3 — student/group can save a draft repeatedly (version
 * history is append-only: each save is a new submission_version, never
 * an edit to a previous one). Reviving a 'needs_revision' submission
 * back to 'draft' happens here too, on the student's first save after
 * getting feedback.
 */
export async function saveSubmissionDraft(assignmentId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getSubmitterContext(assignmentId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, user, assignment, groupId } = ctx;

  const note = String(formData.get("note") ?? "").trim();
  const links: { asset_type: SubmissionAssetType; url: string }[] = [];
  for (const type of SUBMISSION_ASSET_TYPES) {
    const value = String(formData.get(type) ?? "").trim();
    if (value) links.push({ asset_type: type, url: value });
  }
  if (!note && links.length === 0) {
    return { error: "Cần ít nhất ghi chú hoặc một link minh chứng." };
  }

  const ownerFilter = assignment.submission_mode === "group" ? { group_id: groupId } : { profile_id: user.id };
  const { data: existing } = await supabase
    .from("submissions")
    .select("id, status")
    .eq("assignment_id", assignmentId)
    .match(ownerFilter)
    .maybeSingle();

  if (existing?.status === "locked") {
    return { error: "Bài đã khoá — chờ review trước khi sửa tiếp." };
  }

  let submissionId = existing?.id;
  if (!submissionId) {
    const { data: created, error: createError } = await supabase
      .from("submissions")
      .insert({ assignment_id: assignmentId, ...ownerFilter, status: "draft", last_updated_by: user.id })
      .select("id")
      .single();
    if (createError) return { error: createError.message };
    submissionId = created.id;
  } else {
    await supabase.from("submissions").update({ last_updated_by: user.id, status: "draft" }).eq("id", submissionId);
  }

  const { count } = await supabase
    .from("submission_versions")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", submissionId);
  const versionNumber = (count ?? 0) + 1;

  const { data: version, error: versionError } = await supabase
    .from("submission_versions")
    .insert({ submission_id: submissionId, version_number: versionNumber, note: note || null, created_by: user.id })
    .select("id")
    .single();
  if (versionError) return { error: versionError.message };

  if (links.length > 0) {
    const { error: assetsError } = await supabase
      .from("submission_assets")
      .insert(links.map((l) => ({ submission_version_id: version.id, asset_type: l.asset_type, url: l.url })));
    if (assetsError) {
      return { error: `Đã lưu bản nháp nhưng chưa lưu được link: ${assetsError.message}` };
    }
  }

  revalidatePath(`/app/assignments/${assignmentId}`);
  return {};
}

/**
 * Section 12.3 safeguard: "Confirm before official submission ... Lock
 * the submitted version" — same submit=lock simplification as
 * attendance sheets (README flagged deviation), skipping the DB enum's
 * separate 'submitted' value.
 */
export async function submitOfficialSubmission(assignmentId: string, submissionId: string): Promise<ActionResult> {
  const ctx = await getSubmitterContext(assignmentId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, user, groupId } = ctx;

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, assignment_id, status, profile_id, group_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission || submission.assignment_id !== assignmentId) return { error: "Không tìm thấy bài nộp." };
  if (submission.status === "locked") return { error: "Bài đã được nộp rồi." };

  const { count } = await supabase
    .from("submission_versions")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", submissionId);
  if (!count) return { error: "Cần lưu ít nhất một bản nháp trước khi nộp chính thức." };

  const { error } = await supabase
    .from("submissions")
    .update({ status: "locked", locked_at: new Date().toISOString(), last_updated_by: user.id })
    .eq("id", submissionId);
  if (error) return { error: error.message };

  // Section 16.1 — 'submission' notification to the Trainer/Owner who
  // created the assignment (the "own path" reviewer — see
  // getAssignmentAccess), so they know a locked submission is waiting.
  await createNotifications(supabase, {
    programId: ctx.assignment.program_id,
    recipientProfileIds: [ctx.assignment.created_by],
    type: "submission",
    title: "Có bài nộp mới cần review",
    body: ctx.assignment.title,
    linkHref: `/app/assignments/${assignmentId}`,
    excludeProfileId: user.id,
  });

  // Section 12.3 safeguard "Notify the entire group after submission"
  // (also section 22 MVP acceptance: "Official submit ... notifies
  // the group") — group-mode assignments only; an individual
  // submission has no group to notify.
  if (groupId) {
    const { data: members } = await supabase.from("group_members").select("profile_id").eq("group_id", groupId);
    await createNotifications(supabase, {
      programId: ctx.assignment.program_id,
      recipientProfileIds: (members ?? []).map((m) => m.profile_id),
      type: "submission",
      title: "Nhóm bạn vừa nộp chính thức",
      body: ctx.assignment.title,
      linkHref: `/app/assignments/${assignmentId}`,
      excludeProfileId: user.id,
    });
  }

  revalidatePath(`/app/assignments/${assignmentId}`);
  revalidatePath("/app/assignments");
  revalidatePath("/app");
  return {};
}
