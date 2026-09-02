"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingFormState {
  error?: string;
}

/**
 * Section 5.2/5.3 — completes the first-login flow in one screen
 * (a deliberate simplification of the 4-step diagram: "Activate
 * account/set password" is folded into this form's optional password
 * field instead of a separate screen). Writes the editable profile
 * fields, marks onboarding done, and — via the SECURITY DEFINER RPC
 * activate_own_membership() (supabase/migrations/0003_onboarding.sql)
 * — flips the caller's own program_membership from 'invited' to
 * 'active'. Everything here runs through the RLS-scoped client; the
 * only privileged step is that single narrow RPC.
 *
 * README flagged deviation (theo yêu cầu của bạn, áp dụng đồng bộ với
 * "Chỉnh sửa hồ sơ"): không còn hỏi riêng "Tên hiển thị" (Họ tên dùng
 * làm tên hiển thị luôn — `display_name` tự đồng bộ = `full_name`),
 * "Đơn vị / tổ chức" (bỏ hẳn), "Chức danh / thông tin sinh viên" (Vai
 * trò do Owner gán khi mời, hệ thống tự link — không phải trường tự
 * nhập ở đây), và không còn chọn Giao diện (topbar đã có
 * `ThemeToggle`).
 */
export async function completeOnboarding(
  _prevState: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();
  const notifyInApp = formData.get("notifyInApp") === "on";
  const password = String(formData.get("password") ?? "");

  if (!fullName) {
    return { error: "Vui lòng nhập họ tên." };
  }
  if (password && password.length < 8) {
    return { error: "Mật khẩu mới cần ít nhất 8 ký tự." };
  }

  if (password) {
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      return { error: "Không thể đặt mật khẩu mới. Vui lòng thử lại." };
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      display_name: fullName,
      avatar_url: avatarUrl || null,
      // Only 'in_app' is functional — no email adapter is wired up
      // (see README flagged deviation), so an 'email' preference here
      // would be a control that silently does nothing.
      notification_preferences: { in_app: notifyInApp },
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: "Không thể lưu hồ sơ. Vui lòng thử lại." };
  }

  const { error: activateError } = await supabase.rpc("activate_own_membership");
  if (activateError) {
    // Non-fatal here — the protected layout's membership check
    // (lib/auth/get-current-user.ts) will surface a clear no-access
    // screen if this genuinely left the membership un-activated,
    // rather than silently letting a half-activated user into /app.
    console.error("activate_own_membership failed", activateError);
  }

  redirect("/app");
}

// ---------------------------------------------------------------------
// Section 5.3 "Chỉnh sửa hồ sơ" — after onboarding, not the first-login
// flow above. Rút gọn còn avatar/họ tên/thông báo (theo yêu cầu của
// bạn — xem doc-comment ở components/profile/profile-edit-form.tsx cho
// đầy đủ lý do từng trường bị bỏ). Email/vai trò/môn học/nhóm/trạng
// thái vẫn read-only ở UI (system-controlled) — action này chưa từng
// và vẫn không đụng tới chúng.
// ---------------------------------------------------------------------

export interface UpdateProfileState {
  error?: string;
  success?: string;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Chưa đăng nhập." };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const notifyInApp = formData.get("notifyInApp") === "on";
  const removeAvatar = formData.get("removeAvatar") === "on";

  if (!fullName) {
    return { error: "Vui lòng nhập họ tên." };
  }

  // undefined = don't touch avatar_url at all; null = clear it; string
  // = the new uploaded file's public URL.
  let avatarUrl: string | null | undefined;
  const avatarFile = formData.get("avatarFile");
  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (!ALLOWED_AVATAR_TYPES.includes(avatarFile.type)) {
      return { error: "Ảnh đại diện phải là PNG, JPEG, WEBP hoặc GIF." };
    }
    if (avatarFile.size > MAX_AVATAR_BYTES) {
      return { error: "Ảnh đại diện tối đa 5MB." };
    }
    // Section 20 — avatar is optional (never required), so this branch
    // only runs when the user actually picked a file this save.
    const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatarFile, {
      contentType: avatarFile.type,
      upsert: true,
    });
    if (uploadError) {
      return { error: `Không thể tải ảnh lên: ${uploadError.message}` };
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    avatarUrl = pub.publicUrl;
    // Best-effort only — old avatar files are not deleted from Storage
    // (avatar_url only stores the current public URL, not a
    // reconstructible object path), see README flagged deviation.
  } else if (removeAvatar) {
    avatarUrl = null;
  }

  const update: {
    full_name: string;
    display_name: string;
    notification_preferences: { in_app: boolean };
    avatar_url?: string | null;
  } = {
    full_name: fullName,
    // Họ tên dùng làm tên hiển thị luôn (theo yêu cầu của bạn) — không
    // còn ô "Tên hiển thị" riêng, đồng bộ thẳng ở đây.
    display_name: fullName,
    notification_preferences: { in_app: notifyInApp },
  };
  if (avatarUrl !== undefined) update.avatar_url = avatarUrl;

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    return { error: "Không thể lưu hồ sơ. Vui lòng thử lại." };
  }

  revalidatePath("/app/profile");
  revalidatePath("/app", "layout");
  return { success: "Đã lưu hồ sơ." };
}

// ---------------------------------------------------------------------
// "Đổi mật khẩu" tự phục vụ (theo yêu cầu của bạn — mục "authen": trước
// đó ô đổi mật khẩu chỉ có ở Onboarding lần đầu và bị khoá vĩnh viễn sau
// đó, "Chỉnh sửa hồ sơ" cố tình bỏ hẳn mật khẩu — nay thêm lại thành 1
// action riêng, dùng được bất kỳ lúc nào sau khi đăng nhập). Không yêu
// cầu mật khẩu cũ (GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD
// không bật cho project này — giống cách updateUser({password}) đã dùng
// sẵn ở completeOnboarding phía trên).
// ---------------------------------------------------------------------

export interface ChangePasswordState {
  error?: string;
  success?: string;
}

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Chưa đăng nhập." };
  }

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Mật khẩu mới cần ít nhất 8 ký tự." };
  }
  if (password !== confirmPassword) {
    return { error: "Xác nhận mật khẩu chưa khớp." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Không thể đổi mật khẩu. Vui lòng thử lại." };
  }

  return { success: "Đã đổi mật khẩu." };
}
