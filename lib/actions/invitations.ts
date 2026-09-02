"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { ROLES, GROUP_ASSIGNABLE_ROLES, type Role } from "@/lib/constants/roles";
import { createNotifications } from "@/lib/notifications/create";
import { generateRandomPassword } from "@/lib/utils/password";

export interface InviteFormState {
  error?: string;
  success?: string;
  // Hiện đúng 1 lần ngay sau khi tạo account mới (theo yêu cầu của bạn
  // — không qua email mời nữa) để Owner copy gửi thủ công cho người đó.
  // Supabase không cho xem lại mật khẩu sau lần này, và không set 2
  // field này ở nhánh "email đã tồn tại" (không đổi mật khẩu cũ).
  createdEmail?: string;
  createdPassword?: string;
}

export interface ActionResult {
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Section 4.2 — every write in this file is Owner-only. RLS already
 * enforces this on the direct table writes below (program_memberships,
 * group_members, mentor_assignments all use is_owner(program_id) in
 * their policies), but the invite flow's first step
 * (admin.inviteUserByEmail) goes through the service-role client, which
 * bypasses RLS entirely — so this check is the only gate for that one
 * step, not defense in depth.
 */
async function requireOwner(programId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "Chưa đăng nhập." };
  }

  const { data: membership } = await supabase
    .from("program_memberships")
    .select("role, status")
    .eq("program_id", programId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "owner" || membership.status !== "active") {
    return { ok: false as const, error: "Chỉ Owner mới có thể thực hiện thao tác này." };
  }

  return { ok: true as const, supabase, ownerProfileId: user.id };
}

export async function inviteMember(
  _prevState: InviteFormState,
  formData: FormData
): Promise<InviteFormState> {
  const programId = String(formData.get("programId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;
  const groupId = String(formData.get("groupId") ?? "") || null;
  // Trainer only — xem 0018_trainer_group_assignments.sql. "groupIds"
  // (nhiều nhóm, chỉ để hiển thị) tách hẳn khỏi "groupId" số ít ở trên
  // (student/mentor, có ý nghĩa gán thật qua group_members/mentor_assignments).
  const trainerGroupIds = formData.getAll("groupIds").map(String).filter(Boolean);
  // Trainer only — chọn sẵn buổi học phụ trách, gán thẳng vào
  // sessions.trainer_profile_ids ngay lúc mời thay vì phải vào Thời khóa
  // biểu gán từng buổi sau (theo yêu cầu của bạn).
  const trainerSessionIds = formData.getAll("sessionIds").map(String).filter(Boolean);
  const password = String(formData.get("password") ?? "");

  if (!programId) return { error: "Thiếu chương trình." };
  if (!fullName) return { error: "Vui lòng nhập họ tên." };
  if (!EMAIL_RE.test(email)) return { error: "Email không hợp lệ." };
  if (!ROLES.includes(role)) return { error: "Vai trò không hợp lệ." };
  if (password.length < 8) return { error: "Mật khẩu cần ít nhất 8 ký tự." };

  const guard = await requireOwner(programId);
  if (!guard.ok) return { error: guard.error };
  const { supabase, ownerProfileId } = guard;

  const admin = createServiceRoleClient();

  // Section 5.1/5.2 — deviation theo yêu cầu của bạn: Owner tạo thẳng
  // account bằng email thật + mật khẩu tự đặt (admin.createUser,
  // email_confirm: true), KHÔNG còn gửi mail mời (admin.inviteUserByEmail)
  // — bỏ hẳn phụ thuộc SMTP của Supabase Auth. Owner tự gửi thủ công
  // email/mật khẩu cho từng người qua kênh nội bộ (Zalo/tin nhắn...).
  let profileId: string;
  let isNewAccount = false;
  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    const alreadyExists = /already.*(registered|exists)/i.test(createError.message);
    if (!alreadyExists) {
      return { error: `Không thể tạo tài khoản: ${createError.message}` };
    }
    // Account already exists (typo re-tạo, hoặc đã cấp trước đó dưới vai
    // trò khác). Look it up instead of failing outright — fine at this
    // program's scale (dozens of accounts), a full listUsers page covers
    // it without needing a dedicated lookup-by-email endpoint. KHÔNG đổi
    // mật khẩu cũ ở đây — dùng resetMemberPassword riêng nếu cần.
    const { data: existing, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) {
      return { error: "Email đã tồn tại nhưng không thể tra cứu tài khoản. Thử lại." };
    }
    const match = existing.users.find((u) => u.email?.toLowerCase() === email);
    if (!match) {
      return { error: "Email đã tồn tại trong hệ thống nhưng không tìm thấy tài khoản tương ứng." };
    }
    profileId = match.id;
  } else {
    profileId = createData.user.id;
    isNewAccount = true;
  }

  const { error: membershipError } = await supabase.from("program_memberships").upsert(
    {
      program_id: programId,
      profile_id: profileId,
      invited_email: email,
      role,
      status: "invited",
      invited_by: ownerProfileId,
    },
    { onConflict: "program_id,profile_id" }
  );

  if (membershipError) {
    return { error: `Không thể lưu vai trò/nhóm: ${membershipError.message}` };
  }

  if (groupId && role === "student") {
    await supabase
      .from("group_members")
      .upsert({ group_id: groupId, profile_id: profileId }, { onConflict: "group_id,profile_id" });
  } else if (groupId && (role === "mentor_zps" || role === "mentor_student")) {
    await supabase
      .from("mentor_assignments")
      .upsert(
        { group_id: groupId, profile_id: profileId, mentor_type: role },
        { onConflict: "group_id,mentor_type" }
      );
  } else if (role === "trainer") {
    if (trainerGroupIds.length > 0) {
      await supabase
        .from("trainer_group_assignments")
        .upsert(
          trainerGroupIds.map((gid) => ({ group_id: gid, profile_id: profileId })),
          { onConflict: "group_id,profile_id" }
        );
    }
    if (trainerSessionIds.length > 0) {
      // Đọc trước trainer_profile_ids hiện có của từng buổi rồi APPEND
      // (không ghi đè) — .in(...).eq("program_id", programId) để chặn
      // luôn trường hợp form bị chỉnh tay gửi session của chương trình khác.
      const { data: targetSessions } = await supabase
        .from("sessions")
        .select("id, trainer_profile_ids")
        .eq("program_id", programId)
        .in("id", trainerSessionIds);
      for (const s of targetSessions ?? []) {
        const current = (s.trainer_profile_ids as string[] | null) ?? [];
        if (!current.includes(profileId)) {
          await supabase
            .from("sessions")
            .update({ trainer_profile_ids: [...current, profileId] })
            .eq("id", s.id);
        }
      }
      revalidatePath("/app/schedule");
    }
  }

  revalidatePath("/app/people");
  return isNewAccount
    ? {
        success: `Đã tạo tài khoản cho ${email}. Gửi thông tin đăng nhập bên dưới cho họ qua kênh nội bộ — trang này sẽ không hiện lại mật khẩu.`,
        createdEmail: email,
        createdPassword: password,
      }
    : { success: `Email ${email} đã có tài khoản từ trước — đã cập nhật vai trò/nhóm, KHÔNG đổi mật khẩu cũ.` };
}

export async function changeMemberRole(
  membershipId: string,
  programId: string,
  role: Role
): Promise<ActionResult> {
  if (!ROLES.includes(role)) return { error: "Vai trò không hợp lệ." };
  const guard = await requireOwner(programId);
  if (!guard.ok) return { error: guard.error };

  const { error } = await guard.supabase
    .from("program_memberships")
    .update({ role })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  revalidatePath("/app/people");
  return {};
}

export async function changeMemberStatus(
  membershipId: string,
  programId: string,
  status: "active" | "suspended" | "archived"
): Promise<ActionResult> {
  const guard = await requireOwner(programId);
  if (!guard.ok) return { error: guard.error };

  const { error } = await guard.supabase
    .from("program_memberships")
    .update({ status })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  revalidatePath("/app/people");
  return {};
}

/**
 * Section 5.3 lists "Assigned group(s)" as system-controlled/read-only on
 * the member's OWN profile — this is the admin side of that: Owner
 * reassigns a student/mentor to a different group from People & Access,
 * the same place role/status already get changed. Was deferred as its
 * own build step (see README) because until now there was no UI at all
 * for "move someone to a different group after they're invited" — only
 * assigning a group at invite time (inviteMember above).
 *
 * Students may only ever hold one group at a time in this app (each
 * group's roster is independent group_members rows, but the UI/product
 * model — 8 fixed project groups — never puts one student in two), so
 * reassigning always clears any prior group_members row for this
 * profile within the program before adding the new one. Mentors work
 * the same way but through mentor_assignments, which additionally has a
 * hard DB constraint of one mentor_zps + one mentor_student PER GROUP
 * (mentor_assignments_unique) — silently overwriting whoever already
 * holds that slot would quietly kick them out of the group with no
 * notice, so that case is rejected instead: Owner must first move the
 * existing mentor out.
 */
export async function changeMemberGroup(
  membershipId: string,
  programId: string,
  profileId: string,
  role: Role,
  groupId: string
): Promise<ActionResult> {
  if (!(GROUP_ASSIGNABLE_ROLES as readonly string[]).includes(role)) {
    return { error: "Vai trò này không gán theo nhóm (Trainer gán qua Thời khóa biểu)." };
  }
  const guard = await requireOwner(programId);
  if (!guard.ok) return { error: guard.error };
  const { supabase } = guard;

  let targetGroupName: string | null = null;
  if (groupId) {
    const { data: group } = await supabase
      .from("groups")
      .select("id, name")
      .eq("id", groupId)
      .eq("program_id", programId)
      .maybeSingle();
    if (!group) return { error: "Không tìm thấy nhóm." };
    targetGroupName = group.name;
  }

  const { data: programGroups } = await supabase.from("groups").select("id").eq("program_id", programId);
  const programGroupIds = (programGroups ?? []).map((g) => g.id);

  if (role === "student") {
    if (programGroupIds.length > 0) {
      await supabase.from("group_members").delete().eq("profile_id", profileId).in("group_id", programGroupIds);
    }
    if (groupId) {
      const { error } = await supabase
        .from("group_members")
        .upsert({ group_id: groupId, profile_id: profileId }, { onConflict: "group_id,profile_id" });
      if (error) return { error: error.message };
    }
  } else {
    if (groupId) {
      const { data: existingSlot } = await supabase
        .from("mentor_assignments")
        .select("profile_id")
        .eq("group_id", groupId)
        .eq("mentor_type", role)
        .maybeSingle();
      if (existingSlot && existingSlot.profile_id !== profileId) {
        return {
          error: `Nhóm này đã có ${
            role === "mentor_zps" ? "Mentor ZPS" : "Mentor Sinh viên"
          } khác phụ trách — gỡ người đó khỏi nhóm trước khi gán người mới.`,
        };
      }
    }
    if (programGroupIds.length > 0) {
      await supabase
        .from("mentor_assignments")
        .delete()
        .eq("profile_id", profileId)
        .eq("mentor_type", role)
        .in("group_id", programGroupIds);
    }
    if (groupId) {
      const { error } = await supabase
        .from("mentor_assignments")
        .upsert({ group_id: groupId, profile_id: profileId, mentor_type: role }, { onConflict: "group_id,mentor_type" });
      if (error) return { error: error.message };
    }
  }

  await createNotifications(supabase, {
    programId,
    recipientProfileIds: [profileId],
    type: "group_change",
    title: groupId ? `Bạn đã được chuyển sang nhóm "${targetGroupName}"` : "Bạn đã được gỡ khỏi nhóm",
    linkHref: groupId ? `/app/groups/${groupId}` : null,
  });

  revalidatePath("/app/people");
  revalidatePath("/app/groups");
  return {};
}

/**
 * "Đặt lại mật khẩu" — Owner-only (theo yêu cầu của bạn, thay cho việc
 * dùng lại inviteMember/re-invite khi ai đó quên mật khẩu: re-invite sẽ
 * gọi lại admin.createUser/inviteUserByEmail và có thể gửi lại mail —
 * ngược với mục tiêu bỏ hẳn phụ thuộc email của cả luồng authen này).
 * Sinh 1 mật khẩu ngẫu nhiên mới, set thẳng bằng admin.updateUserById
 * (service-role, không qua RLS — cùng mức đặc quyền như tạo account ở
 * inviteMember), KHÔNG gửi email. Trả mật khẩu mới về đúng 1 lần để
 * Owner copy gửi thủ công, giống lúc tạo account.
 */
export interface ResetPasswordResult {
  error?: string;
  password?: string;
  email?: string;
}

export async function resetMemberPassword(profileId: string, programId: string): Promise<ResetPasswordResult> {
  const guard = await requireOwner(programId);
  if (!guard.ok) return { error: guard.error };
  const { supabase } = guard;

  // Xác nhận người này thực sự thuộc chương trình đang thao tác — chặn
  // Owner chương trình A đặt lại mật khẩu người của chương trình B chỉ
  // vì biết profileId (RLS không chặn admin.updateUserById vì nó bypass
  // RLS, nên check này là lớp chặn duy nhất cho đúng bước gọi service-role).
  const { data: membership } = await supabase
    .from("program_memberships")
    .select("profile_id")
    .eq("program_id", programId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!membership) return { error: "Không tìm thấy thành viên trong chương trình này." };

  const { data: profile } = await supabase.from("profiles").select("email").eq("id", profileId).maybeSingle();

  const newPassword = generateRandomPassword();
  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.updateUserById(profileId, { password: newPassword });
  if (error) return { error: `Không thể đặt lại mật khẩu: ${error.message}` };

  return { password: newPassword, email: profile?.email ?? undefined };
}
