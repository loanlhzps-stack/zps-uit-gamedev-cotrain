import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAssignmentAccess } from "@/lib/assignments/access";
import { getAssignmentMeta, getSubmissionsForAssignment, type SubmissionWithHistory } from "@/lib/assignments/queries";
import { getStudentGroupId, getMentorGroupIds } from "@/lib/attendance/queries";
import { AssignmentStatusBadge } from "@/components/assignments/status-badges";
import { AssignmentEditForm } from "@/components/assignments/assignment-edit-form";
import { SubmissionPanel } from "@/components/assignments/submission-panel";
import { ReviewList } from "@/components/assignments/review-list";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDueAt, formatDueRelative } from "@/lib/format/assignments";

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const access = await getAssignmentAccess(assignmentId);
  if (!access.ok) {
    notFound();
  }
  const { user, programId, isOwnerOrCo, canEditMeta, canReview, isOverrideReview } = access;

  let backHref = "/app/assignments";
  if (user.role === "student") {
    const groupId = await getStudentGroupId(user.id);
    if (groupId) backHref = `/app/groups/${groupId}?tab=assignments`;
  } else if (user.role === "mentor_zps" || user.role === "mentor_student") {
    // Mentor không còn menu "Bài tập" riêng nữa (theo yêu cầu của bạn,
    // xem 0016_mentor_parity.sql) — quay lại đúng nhóm mình phụ trách
    // thay vì trang danh sách đã bị chặn.
    const [groupId] = await getMentorGroupIds(user.id);
    if (groupId) backHref = `/app/groups/${groupId}?tab=assignments`;
  }

  const [meta, submissions] = await Promise.all([
    getAssignmentMeta(assignmentId),
    getSubmissionsForAssignment(assignmentId),
  ]);
  if (!meta) {
    notFound();
  }

  const reviewItems = submissions.map((s) => ({
    id: s.id,
    ownerLabel: s.ownerLabel,
    status: s.status,
    latestNote: s.versions[0]?.note ?? null,
    latestAssets: s.versions[0]?.assets ?? [],
    versionCount: s.versions.length,
  }));

  return (
    <div className="space-y-5">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Bài tập
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{meta.title}</CardTitle>
            <AssignmentStatusBadge status={meta.status} dueAt={meta.dueAt} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {meta.description && (
            <p className="whitespace-pre-wrap text-[13px] text-text-secondary">{meta.description}</p>
          )}
          <div className="grid gap-2 text-[12.5px] text-text-secondary sm:grid-cols-2">
            <p>
              Người tạo: <span className="font-semibold text-text-primary">{meta.createdByName}</span>
            </p>
            <p>
              Hình thức nộp:{" "}
              <span className="font-semibold text-text-primary">
                {meta.submissionMode === "group" ? "Theo nhóm" : "Cá nhân"}
              </span>
            </p>
            {meta.dueAt && (
              <p>
                Deadline:{" "}
                <span className="font-semibold text-text-primary">
                  {formatDueAt(meta.dueAt)} ({formatDueRelative(meta.dueAt)})
                </span>
              </p>
            )}
            {meta.sessionLabel && (
              <p>
                Buổi học: <span className="font-semibold text-text-primary">{meta.sessionLabel}</span>
              </p>
            )}
          </div>
          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-text-primary">Đối tượng</span>
            <div className="flex flex-wrap gap-1.5">
              {meta.targets.map((t, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border px-2.5 py-1 text-[11.5px] font-medium text-text-secondary"
                >
                  {t.label}
                </span>
              ))}
              {meta.targets.length === 0 && (
                <span className="text-[11.5px] text-text-secondary">Chưa chọn đối tượng.</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {canEditMeta && (
        <AssignmentEditForm
          assignmentId={meta.id}
          programId={programId}
          title={meta.title}
          description={meta.description}
          dueAt={meta.dueAt}
          status={meta.status}
          isOwnerOrCo={isOwnerOrCo}
        />
      )}

      {canReview && <ReviewList assignmentId={assignmentId} isOverrideReview={isOverrideReview} submissions={reviewItems} />}

      {!canReview && (user.role === "mentor_zps" || user.role === "mentor_student") && (
        <ReviewList assignmentId={assignmentId} isOverrideReview={false} readOnly submissions={reviewItems} />
      )}

      {!canReview && user.role === "student" && (
        <StudentSubmissionSection
          assignmentId={assignmentId}
          submissionMode={meta.submissionMode}
          userId={user.id}
          submissions={submissions}
        />
      )}
    </div>
  );
}

async function StudentSubmissionSection({
  assignmentId,
  submissionMode,
  userId,
  submissions,
}: {
  assignmentId: string;
  submissionMode: "individual" | "group";
  userId: string;
  submissions: SubmissionWithHistory[];
}) {
  let mine: SubmissionWithHistory | undefined;
  let ownerLabel = "Của bạn";

  if (submissionMode === "group") {
    const groupId = await getStudentGroupId(userId);
    mine = submissions.find((s) => s.ownerType === "group" && s.ownerId === groupId);
    ownerLabel = "Nhóm của bạn";
  } else {
    mine = submissions.find((s) => s.ownerType === "profile" && s.ownerId === userId);
  }

  return (
    <SubmissionPanel
      assignmentId={assignmentId}
      ownerLabel={ownerLabel}
      submission={mine ? { id: mine.id, status: mine.status } : null}
      versions={mine?.versions ?? []}
    />
  );
}
