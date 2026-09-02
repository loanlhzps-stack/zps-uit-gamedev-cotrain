import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";

/**
 * Section 13.1/4.2 — who may edit what inside a Group Workspace.
 * Mirrors the RLS built in 0002_rls.sql:
 *   - `groups` (name/image — "group IDENTITY"): groups_update allows
 *     Owner/Co-owner, a STUDENT group member (is_group_member), or
 *     either assigned Mentor (is_group_mentor) — doc 13.1's literal
 *     "All student members may update the group image, group name..."
 *     originally excluded Mentors here, but 0016_mentor_parity.sql
 *     widened it (theo yêu cầu của bạn: Mentor ZPS/SV có quyền y hệt
 *     nhau trên nhóm mình phụ trách, bao gồm cả sửa tên/ảnh nhóm).
 *   - `group_projects`/`project_members`/`project_builds`/
 *     `project_checklist_status` ("project CONTENT"): their RLS
 *     already includes is_group_mentor (both mentor types) — matches
 *     the permission matrix's "Manage group project: Mentor ZPS/SV =
 *     Own group" row.
 * This is the UI-branch resolution; RLS is still the real boundary.
 */
export async function getGroupWorkspaceAccess(groupId: string) {
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

  let isStudentMember = false;
  let mentorType: "mentor_zps" | "mentor_student" | null = null;
  if (user.role === "student") {
    const { data } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("profile_id", user.id)
      .maybeSingle();
    isStudentMember = !!data;
  } else if (user.role === "mentor_zps" || user.role === "mentor_student") {
    const { data } = await supabase
      .from("mentor_assignments")
      .select("mentor_type")
      .eq("group_id", groupId)
      .eq("profile_id", user.id)
      .maybeSingle();
    mentorType = (data?.mentor_type as "mentor_zps" | "mentor_student" | undefined) ?? null;
  }

  return {
    ok: true as const,
    supabase,
    user,
    programId: group.program_id,
    isOwnerOrCo,
    isStudentMember,
    mentorType,
    isMentor: mentorType !== null,
    canEditIdentity: isOwnerOrCo || isStudentMember || mentorType !== null,
    canEditProjectContent: isOwnerOrCo || isStudentMember || mentorType !== null,
  };
}
