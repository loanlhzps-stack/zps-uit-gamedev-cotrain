import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { ROLE_LABELS, type Role } from "@/lib/constants/roles";

export default async function OnboardingProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle(),
    // Vai trò đã được Owner gán lúc mời (mục 5) — chỉ đọc để hiển thị
    // read-only ở form, không phải trường tự nhập (theo yêu cầu của bạn).
    supabase
      .from("program_memberships")
      .select("role")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profile?.onboarding_completed_at) {
    redirect("/app");
  }

  const roleLabel = membership?.role ? ROLE_LABELS[membership.role as Role] : "—";

  return (
    <OnboardingForm
      defaultFullName={profile?.full_name ?? ""}
      defaultEmail={profile?.email ?? user.email ?? ""}
      roleLabel={roleLabel}
    />
  );
}
