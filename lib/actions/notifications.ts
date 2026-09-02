"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { getMentorGroupIds } from "@/lib/attendance/queries";
import { createNotifications } from "@/lib/notifications/create";
import { resolvePendingSubmitters } from "@/lib/assignments/pending-submitters";

export interface ActionResult {
  error?: string;
}

function paths() {
  revalidatePath("/app/notifications");
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") return { error: "Chưa đăng nhập." };
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_profile_id", result.user.id);
  if (error) return { error: error.message };

  paths();
  return {};
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") return { error: "Chưa đăng nhập." };
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_profile_id", result.user.id)
    .is("read_at", null);
  if (error) return { error: error.message };

  paths();
  return {};
}



/**
 * Section 16.1 — "Owner/Co-owner can send targeted reminders. Trainer
 * can remind targets of owned assignments. Mentors can remind members
 * of their own group." Scope is resolved and re-validated server-side
 * from the actor's real role/assignment/group ownership — form fields
 * are just a request, never trusted as the final scope (same
 * discipline as every other Server Action in this codebase).
 */
export async function sendReminder(formData: FormData): Promise<ActionResult> {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") return { error: "Chưa đăng nhập." };
  const { user } = result;
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) return { error: "Thiếu tiêu đề nhắc nhở." };

  const isOwnerOrCo = user.role === "owner" || user.role === "co_owner";
  const isTrainer = user.role === "trainer";
  const isMentor = user.role === "mentor_zps" || user.role === "mentor_student";

  let recipientIds: string[] = [];
  let linkHref: string | null = null;

  if (isMentor) {
    const groupId = String(formData.get("groupId") ?? "").trim();
    const myGroupIds = await getMentorGroupIds(user.id);
    if (!groupId || !myGroupIds.includes(groupId)) {
      return { error: "Bạn chỉ có thể nhắc nhóm mình phụ trách." };
    }
    const { data: members } = await supabase.from("group_members").select("profile_id").eq("group_id", groupId);
    recipientIds = (members ?? []).map((m) => m.profile_id);
    linkHref = `/app/groups/${groupId}`;
  } else if (isTrainer) {
    const assignmentId = String(formData.get("assignmentId") ?? "").trim();
    const { data: assignment } = await supabase
      .from("assignments")
      .select("id, program_id, created_by")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!assignment || assignment.program_id !== user.programId || assignment.created_by !== user.id) {
      return { error: "Bạn chỉ có thể nhắc cho bài tập mình tạo." };
    }
    recipientIds = await resolvePendingSubmitters(supabase, assignmentId);
    linkHref = `/app/assignments/${assignmentId}`;
    if (recipientIds.length === 0) return { error: "Không có ai đang ở trạng thái nháp/cần chỉnh sửa cho bài tập này." };
  } else if (isOwnerOrCo) {
    const scope = String(formData.get("scope") ?? "");
    if (scope === "program") {
      const { data: memberships } = await supabase
        .from("program_memberships")
        .select("profile_id")
        .eq("program_id", user.programId)
        .eq("status", "active");
      recipientIds = (memberships ?? []).map((m) => m.profile_id);
      linkHref = "/app";
    } else if (scope === "group") {
      const groupId = String(formData.get("groupId") ?? "").trim();
      const { data: group } = await supabase.from("groups").select("id, program_id").eq("id", groupId).maybeSingle();
      if (!group || group.program_id !== user.programId) return { error: "Không tìm thấy nhóm." };
      const { data: members } = await supabase.from("group_members").select("profile_id").eq("group_id", groupId);
      recipientIds = (members ?? []).map((m) => m.profile_id);
      linkHref = `/app/groups/${groupId}`;
    } else if (scope === "students") {
      const profileIds = formData.getAll("profileIds").map(String).filter(Boolean);
      if (profileIds.length === 0) return { error: "Chọn ít nhất một sinh viên." };
      const { data: memberships } = await supabase
        .from("program_memberships")
        .select("profile_id")
        .eq("program_id", user.programId)
        .in("profile_id", profileIds);
      recipientIds = (memberships ?? []).map((m) => m.profile_id);
      // Nhắc tự do cho từng học viên cụ thể, không gắn với 1 assignment/nhóm
      // nào — không có đích cụ thể để trỏ tới, nên về Trang chủ (giống scope
      // "program"). /app/assignments đã bị chặn với role student.
      linkHref = "/app";
    } else if (scope === "assignment_pending") {
      const assignmentId = String(formData.get("assignmentId") ?? "").trim();
      const { data: assignment } = await supabase.from("assignments").select("id, program_id").eq("id", assignmentId).maybeSingle();
      if (!assignment || assignment.program_id !== user.programId) return { error: "Không tìm thấy bài tập." };
      recipientIds = await resolvePendingSubmitters(supabase, assignmentId);
      linkHref = `/app/assignments/${assignmentId}`;
      if (recipientIds.length === 0) return { error: "Không có ai đang ở trạng thái nháp/cần chỉnh sửa cho bài tập này." };
    } else {
      return { error: "Phạm vi nhắc nhở không hợp lệ." };
    }
  } else {
    return { error: "Bạn không có quyền gửi nhắc nhở." };
  }

  if (recipientIds.length === 0) return { error: "Không tìm thấy người nhận." };

  await createNotifications(supabase, {
    programId: user.programId,
    recipientProfileIds: recipientIds,
    type: "reminder",
    title,
    body: body || null,
    linkHref,
    excludeProfileId: user.id,
  });

  paths();
  return {};
}
