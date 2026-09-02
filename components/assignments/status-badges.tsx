import { Badge } from "@/components/ui/badge";
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_VARIANT,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_VARIANT,
  type AssignmentStatus,
  type SubmissionStatus,
} from "@/lib/constants/statuses";
import { isAssignmentOverdue } from "@/lib/format/assignments";

/**
 * "Quá hạn" không phải 1 AssignmentStatus lưu DB (theo yêu cầu của bạn
 * — brainstorm lại mục 12.1) — tự tính ở đây từ `dueAt` khi status vẫn
 * "in_progress" mà đã qua hạn, không cần Trainer/Owner tự đổi. "Hoàn
 * thành" luôn thắng, dù có trễ hạn hay không. Bỏ trống `dueAt` (hoặc
 * không truyền) thì hiện đúng status gốc như cũ.
 */
export function AssignmentStatusBadge({ status, dueAt }: { status: AssignmentStatus; dueAt?: string | null }) {
  if (isAssignmentOverdue(status, dueAt)) {
    return <Badge variant="risk">Quá hạn</Badge>;
  }
  return <Badge variant={ASSIGNMENT_STATUS_VARIANT[status]}>{ASSIGNMENT_STATUS_LABELS[status]}</Badge>;
}

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge variant={SUBMISSION_STATUS_VARIANT[status]}>{SUBMISSION_STATUS_LABELS[status]}</Badge>;
}
