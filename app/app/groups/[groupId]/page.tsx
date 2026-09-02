import { notFound, redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GroupHeader } from "@/components/groups/group-header";
import { GroupWorkspaceTabs, type GroupTab } from "@/components/groups/group-tabs";
import { MembersTable } from "@/components/groups/members-table";
import { ScheduleList } from "@/components/groups/schedule-list";
import { AttendanceMatrix } from "@/components/groups/attendance-matrix";
import { GroupAssignmentsList } from "@/components/groups/group-assignments-list";
import { SurveyReminderList } from "@/components/groups/survey-reminder-list";
import { ProjectMetaForm } from "@/components/groups/project-meta-form";
import { ProjectProgress } from "@/components/groups/project-progress";
import { ProjectBuildsManager } from "@/components/groups/project-builds-manager";
import { ProjectChecklist } from "@/components/groups/project-checklist";
import { getGroupWorkspaceAccess } from "@/lib/groups/access";
import {
  getGroupBasicInfo,
  getGroupMembersDetail,
  getGroupScheduleRows,
  getGroupAttendanceMatrix,
  getGroupProjectData,
} from "@/lib/groups/queries";
import { getAssignmentsForGroup } from "@/lib/assignments/queries";
import { getGroupsWithHealth, getGroupsWithHealthAggregate } from "@/lib/attendance/queries";

export default async function GroupWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { groupId } = await params;
  const { tab: requestedTabId } = await searchParams;
  const access = await getGroupWorkspaceAccess(groupId);
  if (!access.ok) {
    notFound();
  }
  const { user, programId, isStudentMember, isMentor, canEditIdentity, canEditProjectContent } = access;

  // Trainer: không còn quyền xem Nhóm dự án nữa (theo yêu cầu của bạn)
  // — bỏ hẳn, kể cả trang chi tiết qua URL trực tiếp.
  if (user.role === "trainer") {
    redirect("/app");
  }

  // Section 13 — Mentor/Student are scoped to their own group(s); a
  // Mentor/Student browsing another group's URL is bounced back to the
  // group list (a UI-level restriction — RLS already permits any
  // active member to read this data, see lib/groups/access.ts header).
  if (user.role === "student" && !isStudentMember) {
    redirect("/app/groups");
  }
  if ((user.role === "mentor_zps" || user.role === "mentor_student") && !isMentor) {
    redirect("/app/groups");
  }

  const isSponsor = user.role === "sponsor";

  const [basicInfo, healthList, project] = await Promise.all([
    getGroupBasicInfo(groupId),
    isSponsor ? getGroupsWithHealthAggregate(programId) : getGroupsWithHealth(programId),
    getGroupProjectData(groupId),
  ]);
  if (!basicInfo) {
    notFound();
  }
  const health = healthList.find((g) => g.id === groupId) ?? null;

  // The 4 "aggregating" tabs (section 13.3) show per-student detail —
  // restricted to everyone except Sponsor (section 4.3), who only sees
  // Tổng quan (aggregate-framed) + Final Project (read-only).
  const [membersDetail, scheduleRows, attendanceMatrix, groupAssignments] = isSponsor
    ? [[], [], null, []]
    : await Promise.all([
        getGroupMembersDetail(groupId),
        getGroupScheduleRows(programId, groupId),
        getGroupAttendanceMatrix(programId, groupId),
        getAssignmentsForGroup(programId, groupId, user),
      ]);

  const tabs: GroupTab[] = [];

  if (!isSponsor) {
    tabs.push(
      {
        id: "members",
        label: "Thành viên",
        content: (
          <Card>
            <CardHeader>
              <CardTitle>Thành viên</CardTitle>
            </CardHeader>
            <CardContent>
              <MembersTable members={membersDetail} viewerId={user.id} />
            </CardContent>
          </Card>
        ),
      },
      {
        id: "schedule",
        label: "Thời khóa biểu",
        content: <ScheduleList rows={scheduleRows} />,
      },
      {
        id: "assignments",
        label: "Bài tập",
        content: (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Bài tập nhóm</CardTitle>
              </CardHeader>
              <CardContent>
                <GroupAssignmentsList
                  assignments={groupAssignments.filter((a) => a.scope === "group")}
                  emptyText="Nhóm chưa có Bài tập nhóm nào."
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Bài tập cá nhân</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <GroupAssignmentsList
                  assignments={groupAssignments.filter((a) => a.scope === "individual")}
                  emptyText="Chưa có Bài tập cá nhân nào."
                />
                <SurveyReminderList rows={scheduleRows} />
              </CardContent>
            </Card>
          </div>
        ),
      },
      {
        id: "attendance",
        label: "Điểm danh",
        content: attendanceMatrix ? (
          <Card>
            <CardHeader>
              <CardTitle>Điểm danh</CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceMatrix data={attendanceMatrix} groupId={groupId} />
            </CardContent>
          </Card>
        ) : null,
      }
    );
  }

  tabs.push({
    id: "final-project",
    label: "Dự án cuối khoá",
    content: project ? (
      <GroupWorkspaceTabs
        tabs={[
          {
            id: "project-info",
            label: "Thông tin dự án",
            content: <ProjectMetaForm groupId={groupId} value={project} canEdit={canEditProjectContent} />,
          },
          {
            id: "project-progress",
            label: "Tiến độ dự án",
            content: (
              <ProjectProgress
                groupId={groupId}
                value={{
                  milestoneStage: project.milestoneStage,
                  milestoneStatus: project.milestoneStatus,
                  milestoneNextGoal: project.milestoneNextGoal,
                  milestoneDeadline: project.milestoneDeadline,
                  updatedAt: project.updatedAt,
                }}
                canEdit={canEditProjectContent}
              />
            ),
          },
          {
            id: "project-builds",
            label: "Build và tài liệu",
            content: <ProjectBuildsManager groupId={groupId} builds={project.builds} canEdit={canEditProjectContent} />,
          },
          {
            id: "project-checklist",
            label: "Checklist",
            content: <ProjectChecklist groupId={groupId} checklist={project.checklist} canEdit={canEditProjectContent} />,
          },
        ]}
      />
    ) : (
      <p className="text-[13px] text-text-secondary">Nhóm này chưa có dữ liệu Dự án cuối khoá.</p>
    ),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <GroupHeader
        groupId={groupId}
        name={basicInfo.name}
        imageUrl={basicInfo.imageUrl}
        memberCount={basicInfo.memberCount}
        mentorZpsName={basicInfo.mentorZpsName}
        mentorStudentName={basicInfo.mentorStudentName}
        health={health?.health ?? null}
        reasons={health?.reasons ?? []}
        canEdit={canEditIdentity}
        updatedAt={basicInfo.updatedAt}
        lastUpdatedByName={basicInfo.lastUpdatedByName}
      />
      <GroupWorkspaceTabs tabs={tabs} initialTabId={requestedTabId} />
    </div>
  );
}
