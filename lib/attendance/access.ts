import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";

/**
 * Section 3.2/11.2 — who may operate a group's attendance: Owner/
 * Co-owner (any group), or either assigned Mentor (ZPS or SV) of that
 * group. Mirrors RLS's can_operate_attendance() (0002_rls.sql,
 * simplified by 0016_mentor_parity.sql — theo yêu cầu của bạn, cả 2
 * loại Mentor có quyền y hệt nhau, không còn phân biệt "Mentor ZPS chỉ
 * khi nhóm chưa có Mentor SV" nữa) — this is the UI-branch resolution;
 * RLS is still the real access boundary. Shared by
 * lib/actions/attendance.ts (write gate) and the attendance pages
 * (read-branch/edit-vs-view UI).
 */
export async function getGroupAttendanceAccess(groupId: string) {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    return { ok: false as const, error: "Chưa đăng nhập hoặc không có quyền." };
  }
  const { user } = result;

  const supabase = await createClient();
  const { data: group } = await supabase.from("groups").select("id, program_id").eq("id", groupId).maybeSingle();
  if (!group || group.program_id !== user.programId) {
    return { ok: false as const, error: "Không tìm thấy nhóm." };
  }

  const isOwnerOrCo = user.role === "owner" || user.role === "co_owner";

  let canOperate = false;
  let isAssignedMentor = false;
  if (user.role === "mentor_student" || user.role === "mentor_zps") {
    const { data: assignment } = await supabase
      .from("mentor_assignments")
      .select("id")
      .eq("group_id", groupId)
      .eq("profile_id", user.id)
      .maybeSingle();
    isAssignedMentor = !!assignment;
    canOperate = isAssignedMentor;
  }

  return {
    ok: true as const,
    supabase,
    user,
    programId: group.program_id,
    isOwnerOrCo,
    canOperate,
    // Section 4.3 — notes visible to Owner/Co-owner + "the assigned
    // Mentors" (both types, not only whoever currently operates).
    canSeeNotes: isOwnerOrCo || isAssignedMentor,
  };
}
