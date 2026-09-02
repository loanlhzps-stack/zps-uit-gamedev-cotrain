"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { SESSION_STATUSES, type SessionStatus } from "@/lib/constants/statuses";
import { createNotifications } from "@/lib/notifications/create";

export interface ActionResult {
  error?: string;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Section 15/16.1 — the moment a session flips to `completed` is the
 * one clean, event-driven trigger point for two automatic reminders
 * (no scheduled job needed, unlike missing_attendance_sheet's later
 * daily-escalation cron — see README): "buổi học đã kết thúc, đừng
 * quên điểm danh" to each group's Mentor(s) that still has no
 * attendance_sheet for this session yet, and "nhắc thực hiện khảo
 * sát" to every active student, but only when the session actually
 * has a survey_url (section 15: "do not display a false completed
 * state without an integration" — same spirit applies to not nagging
 * about a survey that does not exist).
 *
 * Uses the `missing_attendance_sheet` type for the attendance nudge
 * (semantically correct — it IS a missing sheet, just caught the
 * moment it becomes true instead of by next day's cron) and the
 * generic `reminder` type for the survey nudge (no dedicated enum
 * value exists for "survey" — see README flagged deviation for why
 * reusing `reminder` was chosen over a schema change).
 */
async function notifySessionCompleted(
  supabase: SupabaseServerClient,
  programId: string,
  sessionId: string,
  surveyUrl: string | null
): Promise<void> {
  const [{ data: groups }, { data: sheets }] = await Promise.all([
    supabase.from("groups").select("id").eq("program_id", programId),
    supabase.from("attendance_sheets").select("group_id").eq("session_id", sessionId),
  ]);
  const sheetGroupIds = new Set((sheets ?? []).map((s) => s.group_id));
  const missingGroupIds = (groups ?? []).map((g) => g.id).filter((id) => !sheetGroupIds.has(id));

  if (missingGroupIds.length > 0) {
    const { data: mentors } = await supabase
      .from("mentor_assignments")
      .select("group_id, profile_id")
      .in("group_id", missingGroupIds);
    // One notification per group (not batched across groups) so each
    // one deep-links straight to that group's attendance sheet — also
    // what the daily escalation cron matches on for de-duplication
    // (app/api/cron/daily-notifications/route.ts).
    for (const groupId of missingGroupIds) {
      const mentorIds = [...new Set((mentors ?? []).filter((m) => m.group_id === groupId).map((m) => m.profile_id))];
      if (mentorIds.length === 0) continue;
      await createNotifications(supabase, {
        programId,
        recipientProfileIds: mentorIds,
        type: "missing_attendance_sheet",
        title: "Buổi học đã kết thúc — đừng quên điểm danh",
        linkHref: `/app/attendance/${sessionId}/${groupId}`,
      });
    }
  }

  if (surveyUrl) {
    const { data: students } = await supabase
      .from("program_memberships")
      .select("profile_id")
      .eq("program_id", programId)
      .eq("role", "student")
      .eq("status", "active");
    const studentIds = (students ?? []).map((s) => s.profile_id);
    if (studentIds.length > 0) {
      await createNotifications(supabase, {
        programId,
        recipientProfileIds: studentIds,
        type: "reminder",
        title: "Nhắc thực hiện khảo sát buổi học",
        body: "Thực hiện khảo sát buổi học",
        linkHref: `/app/schedule/${sessionId}`,
      });
    }
  }
}

/**
 * Section 4.2 — "Edit schedule/session": Owner/Co-owner may edit
 * everything; Trainer may edit "own teaching details only" on a session
 * they are assigned to. RLS (sessions_update / session_blocks_write in
 * 0002_rls.sql) already gates this at the ROW level the same way — this
 * just resolves which branch the caller is in once, for the actions
 * below to also gate at the COLUMN level (RLS can't do that — same
 * pattern as attendance_records.note).
 */
async function getSessionAccess(sessionId: string) {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    return { ok: false as const, error: "Chưa đăng nhập hoặc không có quyền." };
  }
  const { user } = result;

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("id, program_id, trainer_profile_ids, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.program_id !== user.programId) {
    return { ok: false as const, error: "Không tìm thấy buổi học." };
  }

  const isOwnerOrCo = user.role === "owner" || user.role === "co_owner";
  const isAssignedTrainer =
    user.role === "trainer" && (session.trainer_profile_ids as string[]).includes(user.id);
  if (!isOwnerOrCo && !isAssignedTrainer) {
    return { ok: false as const, error: "Bạn không có quyền chỉnh sửa buổi học này." };
  }

  return {
    ok: true as const,
    supabase,
    isOwnerOrCo,
    programId: session.program_id,
    previousStatus: session.status as SessionStatus,
  };
}

/**
 * Section 4.2 — creating/deleting sessions and reassigning the
 * Checkpoint milestone are Owner/Co-owner-only, same bar as editing a
 * session's status/location. RLS (sessions_insert/delete,
 * programs_update) enforces the same rule at the row level; this
 * resolves the branch once for the actions below.
 */
async function requireOwnerOrCo(programId: string) {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    return { ok: false as const, error: "Chưa đăng nhập hoặc không có quyền." };
  }
  const { user } = result;
  if (user.programId !== programId) {
    return { ok: false as const, error: "Không tìm thấy chương trình." };
  }
  if (user.role !== "owner" && user.role !== "co_owner") {
    return { ok: false as const, error: "Chỉ Owner/Co-owner mới có thể thực hiện thao tác này." };
  }
  const supabase = await createClient();
  return { ok: true as const, supabase };
}

export async function updateSessionMeta(sessionId: string, formData: FormData): Promise<ActionResult> {
  const access = await getSessionAccess(sessionId);
  if (!access.ok) return { error: access.error };
  const { supabase, isOwnerOrCo } = access;

  const internalNotes = String(formData.get("internalNotes") ?? "").trim();
  const postSessionReflection = String(formData.get("postSessionReflection") ?? "").trim();

  const payload: Record<string, unknown> = {
    internal_notes: internalNotes || null,
    post_session_reflection: postSessionReflection || null,
  };

  if (isOwnerOrCo) {
    const status = String(formData.get("status") ?? "");
    const location = String(formData.get("location") ?? "").trim();
    const surveyUrl = String(formData.get("surveyUrl") ?? "").trim();
    const sessionDate = String(formData.get("sessionDate") ?? "").trim();
    if (!SESSION_STATUSES.includes(status as SessionStatus)) {
      return { error: "Trạng thái không hợp lệ." };
    }
    if (!sessionDate) {
      return { error: "Thiếu ngày học." };
    }
    payload.status = status;
    payload.location = location || null;
    payload.survey_url = surveyUrl || null;
    payload.session_date = sessionDate;
  }

  const { error } = await supabase.from("sessions").update(payload).eq("id", sessionId);
  if (error) {
    if (error.code === "23505") return { error: "Đã có buổi học khác vào ngày này trong chương trình." };
    return { error: error.message };
  }

  if (isOwnerOrCo && payload.status === "completed" && access.previousStatus !== "completed") {
    await notifySessionCompleted(supabase, access.programId, sessionId, (payload.survey_url as string | null) ?? null);
  }

  revalidatePath(`/app/schedule/${sessionId}`);
  revalidatePath("/app/schedule");
  revalidatePath("/app");
  return {};
}

export async function updateSessionBlockMaterials(
  sessionId: string,
  blockId: string,
  materialsUrl: string
): Promise<ActionResult> {
  const access = await getSessionAccess(sessionId);
  if (!access.ok) return { error: access.error };

  const { error } = await access.supabase
    .from("session_blocks")
    .update({ materials_url: materialsUrl.trim() || null })
    .eq("id", blockId)
    .eq("session_id", sessionId);
  if (error) return { error: error.message };

  revalidatePath(`/app/schedule/${sessionId}`);
  return {};
}

/** Owner/Co-owner only — add another learning block to an existing session. */
export async function addSessionBlock(sessionId: string, title: string): Promise<ActionResult> {
  const access = await getSessionAccess(sessionId);
  if (!access.ok) return { error: access.error };
  if (!access.isOwnerOrCo) return { error: "Chỉ Owner/Co-owner mới có thể thêm learning block." };

  const trimmed = title.trim();
  if (!trimmed) return { error: "Thiếu tên learning block." };

  const { count } = await access.supabase
    .from("session_blocks")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const { error } = await access.supabase
    .from("session_blocks")
    .insert({ session_id: sessionId, title: trimmed, sort_order: count ?? 0 });
  if (error) return { error: error.message };

  revalidatePath(`/app/schedule/${sessionId}`);
  revalidatePath("/app/schedule");
  return {};
}

/**
 * Owner/Co-owner only. If this block happens to be the program's
 * Checkpoint milestone (programs.checkpoint_session_id points at this
 * block's session), that reference stays put — a session can hold more
 * than one block, deleting one of them does not mean the Checkpoint
 * itself was removed.
 */
export async function deleteSessionBlock(sessionId: string, blockId: string): Promise<ActionResult> {
  const access = await getSessionAccess(sessionId);
  if (!access.ok) return { error: access.error };
  if (!access.isOwnerOrCo) return { error: "Chỉ Owner/Co-owner mới có thể xoá learning block." };

  const { error } = await access.supabase
    .from("session_blocks")
    .delete()
    .eq("id", blockId)
    .eq("session_id", sessionId);
  if (error) return { error: error.message };

  revalidatePath(`/app/schedule/${sessionId}`);
  revalidatePath("/app/schedule");
  return {};
}

export async function assignTrainers(sessionId: string, trainerProfileIds: string[]): Promise<ActionResult> {
  const access = await getSessionAccess(sessionId);
  if (!access.ok) return { error: access.error };
  if (!access.isOwnerOrCo) {
    return { error: "Chỉ Owner/Co-owner mới có thể gán Trainer." };
  }

  const { error } = await access.supabase
    .from("sessions")
    .update({ trainer_profile_ids: trainerProfileIds })
    .eq("id", sessionId);
  if (error) return { error: error.message };

  revalidatePath(`/app/schedule/${sessionId}`);
  revalidatePath("/app/schedule");
  return {};
}

/**
 * Section 10.1/4.2 — was intentionally out of scope in Phase 5 (README:
 * "Không có UI tạo/xoá buổi học mới", schedule was 16 fixed seeded
 * days). Added back on request: a real class calendar shifts (holidays,
 * makeup days), so Owner/Co-owner need to add a session without going
 * through SQL. Redirects to the new session's detail page on success —
 * this must NOT be wrapped in try/catch (Next.js redirect() throws by
 * design).
 */
export async function createSession(formData: FormData): Promise<ActionResult> {
  const programId = String(formData.get("programId") ?? "");
  const sessionDate = String(formData.get("sessionDate") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const blockTitles = formData
    .getAll("blockTitle")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);

  if (!sessionDate) {
    return { error: "Thiếu ngày học." };
  }
  if (blockTitles.length === 0) {
    return { error: "Cần ít nhất một learning block." };
  }

  const guard = await requireOwnerOrCo(programId);
  if (!guard.ok) return { error: guard.error };
  const { supabase } = guard;

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      program_id: programId,
      session_date: sessionDate,
      location: location || null,
      status: "draft",
    })
    .select("id")
    .single();

  if (sessionError) {
    if (sessionError.code === "23505") return { error: "Đã có buổi học khác vào ngày này trong chương trình." };
    return { error: sessionError.message };
  }

  const { error: blocksError } = await supabase
    .from("session_blocks")
    .insert(blockTitles.map((title, i) => ({ session_id: session.id, title, sort_order: i })));
  if (blocksError) {
    return { error: `Đã tạo buổi học nhưng không thêm được learning block: ${blocksError.message}` };
  }

  revalidatePath("/app/schedule");
  revalidatePath("/app");
  redirect(`/app/schedule/${session.id}`);
}

/**
 * Cascades to session_blocks/attendance_sheets/attendance_records (FKs
 * are ON DELETE CASCADE — see 0001_init.sql). If this session was the
 * program's Checkpoint milestone, checkpoint_session_id is cleared
 * automatically (ON DELETE SET NULL — 0004_program_settings.sql).
 */
export async function deleteSession(sessionId: string, programId: string): Promise<ActionResult> {
  const guard = await requireOwnerOrCo(programId);
  if (!guard.ok) return { error: guard.error };

  const { error } = await guard.supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("program_id", programId);
  if (error) return { error: error.message };

  revalidatePath("/app/schedule");
  revalidatePath("/app");
  redirect("/app/schedule");
}
