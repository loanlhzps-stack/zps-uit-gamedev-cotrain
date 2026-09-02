import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { getNotificationsForUser } from "@/lib/notifications/queries";
import { getMentorGroupIds } from "@/lib/attendance/queries";
import { getAssignmentsForUser, getProgramGroups, getProgramStudents } from "@/lib/assignments/queries";
import type { AppUser } from "@/lib/auth/current-user";
import { NotificationList } from "@/components/notifications/notification-list";
import { ReminderComposer, type ReminderComposerProps } from "@/components/notifications/reminder-composer";

export default async function NotificationsPage() {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }
  const { user } = result;

  const [notifications, composerProps] = await Promise.all([getNotificationsForUser(50), buildComposerProps(user)]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-text-primary">Thông báo</h2>
        <p className="text-[13px] text-text-secondary">Trung tâm thông báo trong ứng dụng.</p>
      </div>

      {composerProps && <ReminderComposer {...composerProps} />}

      <Card>
        <CardHeader>
          <CardTitle>Tất cả thông báo</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationList items={notifications} />
        </CardContent>
      </Card>
    </div>
  );
}

async function buildComposerProps(user: AppUser): Promise<ReminderComposerProps | null> {
  const isOwnerOrCo = user.role === "owner" || user.role === "co_owner";
  const isTrainer = user.role === "trainer";
  const isMentor = user.role === "mentor_zps" || user.role === "mentor_student";

  if (isOwnerOrCo) {
    const [groups, students, assignments] = await Promise.all([
      getProgramGroups(user.programId),
      getProgramStudents(user.programId),
      getAssignmentsForUser(user),
    ]);
    return { mode: "owner", groups, students, assignments: assignments.map((a) => ({ id: a.id, title: a.title })) };
  }

  if (isTrainer) {
    const assignments = await getAssignmentsForUser(user);
    return {
      mode: "trainer",
      groups: [],
      students: [],
      assignments: assignments.filter((a) => a.createdBy === user.id).map((a) => ({ id: a.id, title: a.title })),
    };
  }

  if (isMentor) {
    const groupIds = await getMentorGroupIds(user.id);
    if (groupIds.length === 0) {
      return { mode: "mentor", groups: [], students: [], assignments: [] };
    }
    const supabase = await createClient();
    const { data } = await supabase.from("groups").select("id, name").in("id", groupIds).order("name");
    return { mode: "mentor", groups: data ?? [], students: [], assignments: [] };
  }

  return null;
}
