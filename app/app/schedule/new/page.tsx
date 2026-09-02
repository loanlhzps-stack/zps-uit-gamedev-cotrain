import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { CreateSessionForm } from "@/components/schedule/create-session-form";

export default async function NewSessionPage() {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }
  const { user } = result;

  if (user.role !== "owner" && user.role !== "co_owner") {
    redirect("/app/schedule");
  }

  return (
    <div className="space-y-5">
      <Link
        href="/app/schedule"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Thời khóa biểu
      </Link>
      <CreateSessionForm programId={user.programId} />
    </div>
  );
}
