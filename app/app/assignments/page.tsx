import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AssignmentStatusBadge } from "@/components/assignments/status-badges";
import { CreateAssignmentForm } from "@/components/assignments/create-assignment-form";
import {
  getAssignmentsForUser,
  getProgramGroups,
  getProgramStudents,
  type AssignmentListItem,
} from "@/lib/assignments/queries";
import { formatDueAt, formatDueRelative } from "@/lib/format/assignments";

export default async function AssignmentsPage() {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }
  const { user } = result;

  // Section 6.2 — "Bài tập" nav item is not shown to Sponsor at all
  // (lib/nav.ts); assignments_select RLS also excludes Sponsor rows
  // entirely, so this is a friendly redirect, not the real gate.
  if (user.role === "sponsor") {
    redirect("/app");
  }

  // Student/Mentor: xem bài qua Nhóm dự án (tab Bài tập của nhóm mình)
  // — link ra /app/assignments/[id] vẫn hoạt động bình thường từ đó.
  // Mentor thêm vào theo yêu cầu của bạn (rút gọn menu Mentor còn Trang
  // chủ/Điểm danh/Nhóm dự án, xem 0016_mentor_parity.sql).
  if (user.role === "student" || user.role === "mentor_zps" || user.role === "mentor_student") {
    redirect("/app");
  }

  const isOwnerOrCo = user.role === "owner" || user.role === "co_owner";
  const canCreateAssignment = isOwnerOrCo || user.role === "trainer";

  const assignments = await getAssignmentsForUser(user);

  let sessionOptions: { id: string; label: string }[] = [];
  let groupOptions: { id: string; name: string }[] = [];
  let studentOptions: { id: string; name: string; groupName: string | null }[] = [];

  if (canCreateAssignment) {
    const supabase = await createClient();
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, session_date, trainer_profile_ids")
      .eq("program_id", user.programId)
      .order("session_date", { ascending: true })
      .returns<{ id: string; session_date: string; trainer_profile_ids: string[] }[]>();

    const visibleSessions =
      user.role === "trainer"
        ? (sessions ?? []).filter((s) => s.trainer_profile_ids.includes(user.id))
        : (sessions ?? []);
    sessionOptions = visibleSessions.map((s) => ({ id: s.id, label: s.session_date }));

    [groupOptions, studentOptions] = await Promise.all([
      getProgramGroups(user.programId),
      getProgramStudents(user.programId),
    ]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-extrabold text-text-primary">Bài tập</h2>
      </div>

      {canCreateAssignment && (
        <CreateAssignmentForm
          programId={user.programId}
          isTrainer={user.role === "trainer"}
          sessionOptions={sessionOptions}
          groupOptions={groupOptions}
          studentOptions={studentOptions}
        />
      )}

      <AssignmentList assignments={assignments} />
    </div>
  );
}

function AssignmentList({ assignments }: { assignments: AssignmentListItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bài tập ({assignments.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <p className="text-[13px] text-text-secondary">Chưa có bài tập nào.</p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/app/assignments/${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 transition-colors hover:border-brand-orange-2/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-text-primary">{a.title}</p>
                    <p className="text-[11.5px] text-text-secondary">
                      {a.targetSummary} · {a.createdByName}
                      {a.dueAt && ` · Hạn ${formatDueAt(a.dueAt)} (${formatDueRelative(a.dueAt)})`}
                    </p>
                  </div>
                  <AssignmentStatusBadge status={a.status} dueAt={a.dueAt} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
