import { LogOut } from "lucide-react";
import { LogoFull } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";

type NoAccessReason = "no_membership" | "suspended" | "archived";

const COPY: Record<NoAccessReason, { title: string; body: string }> = {
  no_membership: {
    title: "Chưa có quyền truy cập",
    body: "Tài khoản của bạn chưa được gán vào chương trình nào. Liên hệ Owner/Co-owner để được mời lại.",
  },
  suspended: {
    title: "Tài khoản đang tạm ngưng",
    body: "Quyền truy cập chương trình của bạn đã bị tạm ngưng. Liên hệ Owner/Co-owner nếu đây là nhầm lẫn.",
  },
  archived: {
    title: "Tài khoản đã lưu trữ",
    body: "Quyền truy cập chương trình của bạn đã kết thúc. Liên hệ Owner/Co-owner nếu bạn cần được mời lại.",
  },
};

export function NoAccessScreen({ reason }: { reason: NoAccessReason }) {
  const copy = COPY[reason];
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-7 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <LogoFull height={40} />
        </div>
        <h1 className="text-lg font-extrabold text-text-primary">{copy.title}</h1>
        <p className="mt-2 text-[13px] text-text-secondary">{copy.body}</p>
        <form action={signOutAction} className="mt-5">
          <Button type="submit" variant="secondary" className="w-full">
            <LogOut aria-hidden="true" />
            Đăng xuất
          </Button>
        </form>
      </div>
    </div>
  );
}
