import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import {
  getGroupsWithHealth,
  getGroupsWithHealthAggregate,
  getMentorGroupIds,
  getStudentGroupId,
} from "@/lib/attendance/queries";
import { GROUP_HEALTH_LABELS } from "@/lib/constants/statuses";

const HEALTH_VARIANT = { on_track: "success", need_attention: "warning" } as const;

/**
 * Section 13 — group list. Student/Mentor are scoped to their own
 * group(s) rather than seeing all 8 (a UI-level restriction — RLS
 * still permits any active member to read every group's basic row,
 * see lib/groups/access.ts): a Student, or a Mentor assigned to
 * exactly one group, is sent straight to that Group Workspace; a
 * Mentor assigned to more than one only sees those.
 */
export default async function GroupsPage() {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }
  const { user } = result;

  // Trainer: không còn quyền xem Nhóm dự án nữa (theo yêu cầu của
  // bạn) — bỏ hẳn, không có đường xem thay thế nào như Mentor/Student.
  if (user.role === "trainer") {
    redirect("/app");
  }

  if (user.role === "student") {
    const groupId = await getStudentGroupId(user.id);
    if (groupId) redirect(`/app/groups/${groupId}`);
  }

  const isSponsor = user.role === "sponsor";
  const isMentor = user.role === "mentor_zps" || user.role === "mentor_student";

  let mentorGroupIds: string[] = [];
  if (isMentor) {
    mentorGroupIds = await getMentorGroupIds(user.id);
    if (mentorGroupIds.length === 1) redirect(`/app/groups/${mentorGroupIds[0]}`);
  }

  const groups = isSponsor ? await getGroupsWithHealthAggregate(user.programId) : await getGroupsWithHealth(user.programId);
  const visibleGroups = isMentor ? groups.filter((g) => mentorGroupIds.includes(g.id)) : groups;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h2 className="text-lg font-extrabold text-text-primary">Nhóm dự án</h2>
      </div>
      {visibleGroups.length === 0 ? (
        <p className="text-[13px] text-text-secondary">
          {isMentor
            ? "Bạn chưa được gán vào nhóm nào."
            : user.role === "student"
              ? "Bạn chưa thuộc nhóm nào."
              : "Chương trình chưa có nhóm nào."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleGroups.map((g) => (
            <Link key={g.id} href={`/app/groups/${g.id}`}>
              <Card className="h-full transition-colors hover:border-brand-orange-2/60">
                <CardHeader>
                  <CardTitle>{g.name}</CardTitle>
                  <CardDescription>{g.memberCount} sinh viên</CardDescription>
                  <Badge variant={HEALTH_VARIANT[g.health]} className="mt-1 w-fit">
                    {GROUP_HEALTH_LABELS[g.health]}
                  </Badge>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
