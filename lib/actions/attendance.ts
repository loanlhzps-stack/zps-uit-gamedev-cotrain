"use server";

import { revalidatePath } from "next/cache";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/constants/statuses";
import { getGroupAttendanceAccess } from "@/lib/attendance/access";
import { MAX_ALLOWED_ABSENCES } from "@/lib/attendance/health";
import { createNotifications } from "@/lib/notifications/create";
import type { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Section 16.1 mandatory MVP notification "attendance risk" — fires
 * once, on the sheet lock whose absence record is the one that pushes
 * a student's running total to exactly MAX_ALLOWED_ABSENCES + 1
 * (section 11.3/11.4's 13/16 threshold). Later sheet locks for an
 * already-ineligible student total higher than that and are skipped,
 * so this does not re-notify every subsequent session. Notifies the
 * student themselves and their group's active Mentor(s) — Owner/
 * Co-owner already sees the aggregate signal via group health
 * (lib/attendance/health.ts) on Home/Reports, so is not duplicated
 * here.
 */
async function notifyNewlyIneligibleMembers(
  supabase: SupabaseServerClient,
  programId: string,
  groupId: string,
  sheetId: string
): Promise<void> {
  const { data: sheetRecords } = await supabase
    .from("attendance_records")
    .select("profile_id, status")
    .eq("attendance_sheet_id", sheetId)
    .in("status", ["excused_absence", "unexcused_absence"]);
  const absentProfileIds = (sheetRecords ?? []).map((r) => r.profile_id);
  if (absentProfileIds.length === 0) return;

  const newlyIneligible: string[] = [];
  for (const profileId of absentProfileIds) {
    const { count } = await supabase
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .in("status", ["excused_absence", "unexcused_absence"]);
    if ((count ?? 0) === MAX_ALLOWED_ABSENCES + 1) newlyIneligible.push(profileId);
  }
  if (newlyIneligible.length === 0) return;

  const { data: mentors } = await supabase.from("mentor_assignments").select("profile_id").eq("group_id", groupId);
  const mentorIds = (mentors ?? []).map((m) => m.profile_id);

  await createNotifications(supabase, {
    programId,
    recipientProfileIds: [...newlyIneligible, ...mentorIds],
    type: "attendance_risk",
    title: "Cảnh báo attendance: vượt quá số buổi vắng cho phép",
    body: `Đã vắng quá ${MAX_ALLOWED_ABSENCES}/16 buổi (ngưỡng tối thiểu 13/16).`,
    linkHref: `/app/groups/${groupId}`,
  });
}

/**
 * Creates the sheet + one `not_recorded` record per current group
 * member. Explicit user action (button) rather than an implicit
 * side-effect during page render — Server Components should not
 * mutate on read.
 */
export async function openAttendanceSheet(sessionId: string, groupId: string): Promise<ActionResult> {
  const access = await getGroupAttendanceAccess(groupId);
  if (!access.ok) return { error: access.error };
  if (!access.isOwnerOrCo && !access.canOperate) {
    return { error: "Bạn không có quyền mở điểm danh cho nhóm này." };
  }
  const { supabase } = access;

  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, program_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.program_id !== access.programId) {
    return { error: "Không tìm thấy buổi học." };
  }
  if (session.status !== "attendance_open" && session.status !== "completed") {
    return { error: "Buổi học chưa mở điểm danh." };
  }

  const { data: existing } = await supabase
    .from("attendance_sheets")
    .select("id")
    .eq("session_id", sessionId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (existing) {
    revalidatePath(`/app/attendance/${sessionId}/${groupId}`);
    return {};
  }

  const { data: sheet, error: sheetError } = await supabase
    .from("attendance_sheets")
    .insert({ session_id: sessionId, group_id: groupId, status: "open" })
    .select("id")
    .single();
  if (sheetError) return { error: sheetError.message };

  const { data: members } = await supabase.from("group_members").select("profile_id").eq("group_id", groupId);
  const rows = (members ?? []).map((m) => ({
    attendance_sheet_id: sheet.id,
    profile_id: m.profile_id,
    status: "not_recorded" as const,
  }));
  if (rows.length > 0) {
    const { error: recordsError } = await supabase.from("attendance_records").insert(rows);
    if (recordsError) {
      return { error: `Đã tạo sheet nhưng chưa tạo được danh sách điểm danh: ${recordsError.message}` };
    }
  }

  revalidatePath(`/app/attendance/${sessionId}/${groupId}`);
  revalidatePath("/app/attendance");
  return {};
}

export async function saveAttendanceRecords(
  sessionId: string,
  groupId: string,
  sheetId: string,
  entries: { recordId: string; status: AttendanceStatus; note: string }[]
): Promise<ActionResult> {
  const access = await getGroupAttendanceAccess(groupId);
  if (!access.ok) return { error: access.error };
  if (!access.isOwnerOrCo && !access.canOperate) {
    return { error: "Bạn không có quyền sửa điểm danh nhóm này." };
  }
  const { supabase, canSeeNotes } = access;

  const { data: sheet } = await supabase.from("attendance_sheets").select("id, status").eq("id", sheetId).maybeSingle();
  if (!sheet || sheet.status === "locked") {
    return { error: "Sheet đã khoá — Owner/Co-owner cần Mở lại trước khi sửa." };
  }

  for (const entry of entries) {
    if (!ATTENDANCE_STATUSES.includes(entry.status)) {
      return { error: "Trạng thái điểm danh không hợp lệ." };
    }
  }

  const results = await Promise.all(
    entries.map((entry) =>
      supabase
        .from("attendance_records")
        .update({
          status: entry.status,
          // Column-level privacy (see 0002_rls.sql header): only
          // whoever can already see notes may set one.
          note: canSeeNotes ? entry.note.trim() || null : undefined,
        })
        .eq("id", entry.recordId)
        .eq("attendance_sheet_id", sheetId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath(`/app/attendance/${sessionId}/${groupId}`);
  return {};
}

export async function submitAndLockAttendanceSheet(
  sessionId: string,
  groupId: string,
  sheetId: string
): Promise<ActionResult> {
  const access = await getGroupAttendanceAccess(groupId);
  if (!access.ok) return { error: access.error };
  if (!access.isOwnerOrCo && !access.canOperate) {
    return { error: "Bạn không có quyền nộp điểm danh nhóm này." };
  }
  const { supabase, user } = access;

  const { data: sheet } = await supabase.from("attendance_sheets").select("id, status").eq("id", sheetId).maybeSingle();
  if (!sheet) return { error: "Không tìm thấy sheet." };
  if (sheet.status === "locked") return { error: "Sheet đã khoá rồi." };

  // Section 4.2/10.3 acceptance criteria: "Submitted sheets lock" — no
  // separate manual lock step, submit IS lock (though the enum keeps a
  // distinct 'submitted' value for future use).
  const { error } = await supabase
    .from("attendance_sheets")
    .update({ status: "locked", submitted_by: user.id, submitted_at: new Date().toISOString() })
    .eq("id", sheetId);
  if (error) return { error: error.message };

  await notifyNewlyIneligibleMembers(supabase, access.programId, groupId, sheetId);

  revalidatePath(`/app/attendance/${sessionId}/${groupId}`);
  revalidatePath("/app/attendance");
  revalidatePath("/app");
  return {};
}

/**
 * Owner/Co-owner only. Requires a reason — section 10.3 acceptance
 * criteria ("reopen/correct with an audit reason") — and writes an
 * audit_logs row (section 18.2: "attendance override" must be logged),
 * even though the audit log VIEWER is Phase 10 scope.
 */
export async function reopenAttendanceSheet(
  sessionId: string,
  groupId: string,
  sheetId: string,
  reason: string
): Promise<ActionResult> {
  const access = await getGroupAttendanceAccess(groupId);
  if (!access.ok) return { error: access.error };
  if (!access.isOwnerOrCo) {
    return { error: "Chỉ Owner/Co-owner mới có thể mở lại attendance sheet." };
  }
  const { supabase, programId, user } = access;

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5) {
    return { error: "Cần nhập lý do mở lại (tối thiểu 5 ký tự)." };
  }

  const { data: sheet } = await supabase.from("attendance_sheets").select("id, status").eq("id", sheetId).maybeSingle();
  if (!sheet) return { error: "Không tìm thấy sheet." };
  if (sheet.status !== "locked") return { error: "Chỉ mở lại được sheet đang khoá." };

  const { error } = await supabase
    .from("attendance_sheets")
    .update({
      status: "reopened",
      reopened_by: user.id,
      reopened_at: new Date().toISOString(),
      reopened_reason: trimmedReason,
    })
    .eq("id", sheetId);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    program_id: programId,
    actor_profile_id: user.id,
    action: "attendance_reopen",
    entity_type: "attendance_sheet",
    entity_id: sheetId,
    reason: trimmedReason,
    metadata: { session_id: sessionId, group_id: groupId },
  });

  revalidatePath(`/app/attendance/${sessionId}/${groupId}`);
  revalidatePath("/app/attendance");
  return {};
}
