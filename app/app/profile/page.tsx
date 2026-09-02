import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { ChangePasswordForm } from "@/components/profile/change-password-form";

// Same labels as components/people/member-row.tsx's MemberRow status
// badge — kept as a small local copy rather than a shared export since
// this is the only other place membership status renders as text.
const STATUS_LABELS = {
  invited: "Đã mời",
  active: "Đang hoạt động",
  suspended: "Tạm ngưng",
  archived: "Lưu trữ",
} as const;
const STATUS_VARIANT = {
  invited: "warning",
  active: "success",
  suspended: "warning",
  archived: "neutral",
} as const;

/**
 * Section 5.3 — "Xem hồ sơ" + "Chỉnh sửa hồ sơ" (Profile menu). Email,
 * role, program, group(s) and account status are read-only /
 * system-controlled per the doc — rendered directly here, never passed
 * into ProfileEditForm's editable fields.
 */
export default async function ProfilePage() {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }
  const { user } = result;

  const supabase = await createClient();
  const [{ data: profile }, { data: program }] = await Promise.all([
    supabase.from("profiles").select("notification_preferences").eq("id", user.id).maybeSingle(),
    supabase.from("programs").select("name").eq("id", user.programId).maybeSingle(),
  ]);

  const notifyInApp = (profile?.notification_preferences as { in_app?: boolean } | null)?.in_app ?? true;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <Avatar name={user.fullName} src={user.avatarUrl} size={72} />
          <div>
            <h2 className="text-lg font-extrabold text-text-primary">{user.fullName}</h2>
            <p className="text-sm text-text-secondary">{ROLE_LABELS[user.role]}</p>
          </div>
          <div className="grid w-full gap-1.5 border-t border-border pt-3 text-left text-[12.5px]">
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Môn học" value={program?.name ?? "—"} />
            {user.groupName && <InfoRow label="Nhóm" value={user.groupName} />}
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Trạng thái tài khoản</span>
              <Badge variant={STATUS_VARIANT[user.membershipStatus]}>{STATUS_LABELS[user.membershipStatus]}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProfileEditForm
        fullName={user.fullName}
        avatarUrl={user.avatarUrl ?? null}
        roleLabel={ROLE_LABELS[user.role]}
        notifyInApp={notifyInApp}
      />

      <ChangePasswordForm />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <span className="truncate font-semibold text-text-primary">{value}</span>
    </div>
  );
}
