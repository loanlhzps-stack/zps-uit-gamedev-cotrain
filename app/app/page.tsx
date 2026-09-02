import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WelcomeHeaderClientPart } from "@/components/home/welcome-header";
import { GroupHealthGrid } from "@/components/home/group-health-grid";
import { ActionCenterList, type ActionCenterItem } from "@/components/home/action-center-list";
import { DeadlineList } from "@/components/home/deadline-list";
import { AuditLogTable } from "@/components/reports/audit-log-table";
import { getCurrentAppUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";
import { buildMilestones, currentPhaseLabel, nextMilestone } from "@/lib/schedule/milestones";
import { getProgramSessionStats, getNextUpcomingSession, type UpcomingSessionSummary } from "@/lib/schedule/queries";
import {
  getGroupsWithHealth,
  getGroupsWithHealthAggregate,
  getStudentAttendanceSummary,
  getSponsorAttendanceAverage,
} from "@/lib/attendance/queries";
import {
  getUpcomingDeadlines,
  getOwnerActionSignals,
  getTrainerReviewQueue,
  getGroupAssignmentCompletion,
  getAssignmentsForUser,
  type DeadlineItem,
} from "@/lib/assignments/queries";
import { getAuditLog } from "@/lib/audit/queries";
import { formatSessionDate, formatSessionWeekday } from "@/lib/format/schedule";

interface ProgramPhaseRow {
  starts_on: string | null;
  ends_on: string | null;
  checkpoint_session: { session_date: string } | null;
}

async function getProgramPhase(programId: string) {
  const supabase = await createClient();

  const { data: program } = await supabase
    .from("programs")
    .select("starts_on, ends_on, checkpoint_session:checkpoint_session_id(session_date)")
    .eq("id", programId)
    .maybeSingle<ProgramPhaseRow>();

  if (!program?.starts_on || !program?.ends_on) return null;

  const milestones = buildMilestones({
    startsOn: program.starts_on,
    endsOn: program.ends_on,
    checkpointDate: program.checkpoint_session?.session_date ?? null,
  });
  const todayIso = new Date().toISOString().slice(0, 10);

  return {
    phase: currentPhaseLabel(todayIso, milestones),
    next: nextMilestone(todayIso, milestones),
  };
}

function NextSessionSummary({ session }: { session: UpcomingSessionSummary }) {
  return (
    <>
      <p className="text-[13px] font-semibold text-text-primary">
        {formatSessionWeekday(session.sessionDate)}, {formatSessionDate(session.sessionDate)}
      </p>
      <ul className="mt-1 list-inside list-disc text-[13px] text-text-secondary">
        {session.blocks.length > 0 ? (
          session.blocks.map((b) => <li key={b}>{b}</li>)
        ) : (
          <li>Chưa có learning block</li>
        )}
      </ul>
    </>
  );
}

export default async function HomePage() {
  const result = await getCurrentAppUser();
  if (result.status !== "ok") {
    redirect("/login");
  }
  const { user } = result;

  const isOwnerOrCo = user.role === "owner" || user.role === "co_owner";
  const isMentor = user.role === "mentor_zps" || user.role === "mentor_student";
  const isSponsor = user.role === "sponsor";
  const isTrainer = user.role === "trainer";

  const [
    programPhase,
    sessionStats,
    nextSession,
    groupHealth,
    sponsorGroupHealth,
    sponsorAverage,
    studentSummary,
    deadlines,
    ownerActionSignals,
    trainerReviewQueue,
    studentGroupCompletion,
    ownerAssignments,
    auditLog,
  ] = await Promise.all([
    isOwnerOrCo ? getProgramPhase(user.programId) : Promise.resolve(null),
    isOwnerOrCo || isSponsor ? getProgramSessionStats(user.programId) : Promise.resolve(null),
    isTrainer
      ? getNextUpcomingSession(user.programId, { trainerId: user.id })
      : isMentor || user.role === "student"
        ? getNextUpcomingSession(user.programId)
        : Promise.resolve(null),
    isOwnerOrCo ? getGroupsWithHealth(user.programId) : Promise.resolve(null),
    isSponsor ? getGroupsWithHealthAggregate(user.programId) : Promise.resolve(null),
    isSponsor ? getSponsorAttendanceAverage(user.programId) : Promise.resolve(null),
    user.role === "student" ? getStudentAttendanceSummary(user.id) : Promise.resolve(null),
    isSponsor ? Promise.resolve([] as DeadlineItem[]) : getUpcomingDeadlines(user),
    isOwnerOrCo ? getOwnerActionSignals(user.programId) : Promise.resolve(null),
    isTrainer ? getTrainerReviewQueue(user.id, user.programId) : Promise.resolve(null),
    user.role === "student" && user.groupId
      ? getGroupAssignmentCompletion(user.programId, user.groupId)
      : Promise.resolve(null),
    // Chuyển từ tab Báo cáo (đã bỏ hẳn) về Trang chủ, theo yêu cầu của bạn.
    isOwnerOrCo ? getAssignmentsForUser(user) : Promise.resolve(null),
    isOwnerOrCo ? getAuditLog(user.programId) : Promise.resolve(null),
  ]);

  const progressPercent =
    sessionStats && sessionStats.total > 0 ? Math.round((sessionStats.completed / sessionStats.total) * 100) : 0;
  const missingSheetsCount = groupHealth?.reduce((sum, g) => sum + g.missingSheetsCount, 0) ?? 0;
  // Không còn "draft"/"archived" để loại trừ (rút gọn AssignmentStatus —
  // xem lib/constants/statuses.ts), nên "active" giờ là toàn bộ assignments.
  const completedAssignments = (ownerAssignments ?? []).filter((a) => a.status === "completed");
  const assignmentCompletionPercent =
    ownerAssignments && ownerAssignments.length > 0
      ? Math.round((completedAssignments.length / ownerAssignments.length) * 100)
      : null;

  const actionCenterItems: ActionCenterItem[] = [];
  if (missingSheetsCount > 0) {
    actionCenterItems.push({
      id: "missing-sheets",
      label: `${missingSheetsCount} buổi học đã qua chưa nộp attendance sheet`,
      href: "/app/attendance",
      severity: "warning",
    });
  }
  if (ownerActionSignals && ownerActionSignals.pendingReviewCount > 0) {
    actionCenterItems.push({
      id: "pending-review",
      label: `${ownerActionSignals.pendingReviewCount} bài nộp đang chờ review`,
      href: "/app/assignments",
      severity: "warning",
    });
  }
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <WelcomeHeaderClientPart />

      {/* Section 9.1 — Owner / Co-owner */}
      {isOwnerOrCo && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Giai đoạn chương trình</CardDescription>
                <CardTitle>{programPhase?.phase ?? "Chưa cấu hình"}</CardTitle>
              </CardHeader>
              <CardContent>
                {programPhase?.next ? (
                  <p className="text-[13px] text-text-secondary">
                    Mốc kế tiếp: <span className="font-bold text-text-primary">{programPhase.next.label}</span> —{" "}
                    {formatSessionDate(programPhase.next.isoDate)}
                  </p>
                ) : (
                  <p className="text-[13px] text-text-secondary">
                    Chưa có ngày khai giảng/tổng kết —{" "}
                    <Link href="/app/settings" className="font-semibold text-brand-orange-3 hover:underline">
                      cấu hình ở Program settings
                    </Link>
                    .
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Tiến độ đào tạo</CardDescription>
                <CardTitle>
                  {sessionStats?.completed ?? 0}/{sessionStats?.total ?? 0} buổi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                  <div className="h-full bg-brand-gradient" style={{ width: `${progressPercent}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Attendance sheet còn thiếu</CardDescription>
                <CardTitle>{missingSheetsCount} buổi</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/app/attendance">
                  <Badge variant={missingSheetsCount > 0 ? "warning" : "neutral"}>
                    {missingSheetsCount > 0 ? "Cần nhắc Mentor nộp sheet" : "Không có sheet nào thiếu"}
                  </Badge>
                </Link>
              </CardContent>
            </Card>
            {/* Chuyển từ tab Báo cáo (đã bỏ hẳn) về Trang chủ, theo yêu cầu của bạn. */}
            <Card>
              <CardHeader>
                <CardDescription>Hoàn thành bài tập</CardDescription>
                <CardTitle>{assignmentCompletionPercent === null ? "—" : `${assignmentCompletionPercent}%`}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Action Center</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionCenterList items={actionCenterItems} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Deadline sắp tới</CardTitle>
              </CardHeader>
              <CardContent>
                <DeadlineList items={deadlines} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sức khoẻ 8 nhóm</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupHealthGrid groups={groupHealth ?? []} />
            </CardContent>
          </Card>

          {/* Chuyển từ tab Báo cáo (đã bỏ hẳn) về Trang chủ, theo yêu cầu của bạn. */}
          <Card>
            <CardHeader>
              <CardTitle>Audit log</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditLogTable entries={auditLog ?? []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thao tác nhanh</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2.5">
              <Link href="/app/schedule/new" className={buttonVariants({ size: "sm" })}>
                Tạo buổi học
              </Link>
              <Link href="/app/assignments" className={buttonVariants({ size: "sm", variant: "secondary" })}>
                Tạo Bài tập
              </Link>
              {user.role === "owner" && (
                <Link href="/app/people" className={buttonVariants({ size: "sm", variant: "secondary" })}>
                  Tạo tài khoản
                </Link>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Section 9.2 — Sponsor/President (read-only executive dashboard) */}
      {isSponsor && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardDescription>Tiến độ đào tạo</CardDescription>
                <CardTitle>
                  {sessionStats?.completed ?? 0}/{sessionStats?.total ?? 0} buổi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                  <div className="h-full bg-brand-gradient" style={{ width: `${progressPercent}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Attendance trung bình</CardDescription>
                <CardTitle>{sponsorAverage === null ? "—" : `${sponsorAverage}%`}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Trạng thái 8 nhóm</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupHealthGrid groups={sponsorGroupHealth ?? []} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Section 9.3 — Trainer */}
      {isTrainer && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Buổi dạy sắp tới</CardTitle>
            </CardHeader>
            <CardContent>
              {nextSession ? (
                <>
                  <NextSessionSummary session={nextSession} />
                  <Link
                    href={`/app/schedule/${nextSession.id}`}
                    className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-3 inline-flex" })}
                  >
                    Xem chi tiết buổi học
                  </Link>
                </>
              ) : (
                <p className="text-[13px] text-text-secondary">Bạn chưa được gán buổi dạy sắp tới nào.</p>
              )}
              <Link
                href="/app/schedule"
                className={buttonVariants({ variant: "ghost", size: "sm", className: "mt-2 inline-flex" })}
              >
                Xem lịch đầy đủ
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Hàng chờ chấm bài</CardTitle>
              <CardDescription>Bài đã nộp (khoá) cho bài tập bạn tạo, đang chờ review.</CardDescription>
            </CardHeader>
            <CardContent>
              {trainerReviewQueue && trainerReviewQueue.length > 0 ? (
                <ul className="space-y-2">
                  {trainerReviewQueue.map((item) => (
                    <li key={item.submissionId}>
                      <Link
                        href={`/app/assignments/${item.assignmentId}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:border-brand-orange-2/60"
                      >
                        <span className="truncate text-[13px] font-semibold text-text-primary">
                          {item.assignmentTitle}
                        </span>
                        <span className="shrink-0 text-[12px] text-text-secondary">{item.ownerLabel}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-text-secondary">Không có bài nào đang chờ chấm.</p>
              )}
            </CardContent>
          </Card>
          {/* Chuyển từ tab Báo cáo (đã bỏ hẳn với Trainer) về Trang chủ,
              theo yêu cầu của bạn. */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Deadline bài tập bạn tạo</CardTitle>
            </CardHeader>
            <CardContent>
              <DeadlineList items={deadlines} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Section 9.4 / 9.5 — Mentor ZPS / Mentor Sinh viên */}
      {isMentor && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{user.groupName ?? "Nhóm của bạn"}</CardTitle>
              <CardDescription>
                {nextSession
                  ? `Buổi kế tiếp: ${formatSessionDate(nextSession.sessionDate)}`
                  : "Chưa có buổi học sắp tới"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2.5">
              <Link href="/app/attendance" className={buttonVariants({ size: "sm" })}>
                Điểm danh
              </Link>
              <Link
                href={user.groupId ? `/app/groups/${user.groupId}?tab=assignments` : "/app"}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Bài tập
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Deadline của nhóm</CardTitle>
            </CardHeader>
            <CardContent>
              <DeadlineList
                items={deadlines}
                href={user.groupId ? `/app/groups/${user.groupId}?tab=assignments` : undefined}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Section 9.6 — Student */}
      {user.role === "student" && studentSummary && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>Tỷ lệ tham gia của bạn</CardDescription>
              <CardTitle>
                {studentSummary.attended}/{studentSummary.required} buổi ({studentSummary.percentage}%)
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Buổi học kế tiếp</CardTitle>
            </CardHeader>
            <CardContent>
              {nextSession ? (
                <NextSessionSummary session={nextSession} />
              ) : (
                <p className="text-[13px] text-text-secondary">Chưa có buổi học sắp tới.</p>
              )}
              <Link
                href={user.groupId ? `/app/groups/${user.groupId}?tab=schedule` : "/app"}
                className={buttonVariants({ variant: "ghost", size: "sm", className: "mt-2 inline-flex" })}
              >
                Xem lịch đầy đủ
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Deadline của bạn</CardTitle>
            </CardHeader>
            <CardContent>
              <DeadlineList
                items={deadlines}
                href={user.groupId ? `/app/groups/${user.groupId}?tab=assignments` : undefined}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Bài tập nhóm hoàn thành</CardDescription>
              <CardTitle>
                {studentGroupCompletion ? `${studentGroupCompletion.completed}/${studentGroupCompletion.total}` : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={user.groupId ? `/app/groups/${user.groupId}?tab=assignments` : "/app"}
                className="text-[12.5px] font-semibold text-brand-orange-3 hover:underline"
              >
                Xem chi tiết
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
