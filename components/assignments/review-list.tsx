"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { SubmissionStatusBadge } from "@/components/assignments/status-badges";
import { SUBMISSION_ASSET_TYPE_LABELS, type SubmissionStatus } from "@/lib/constants/statuses";
import { reviewSubmission } from "@/lib/actions/assignments";

export interface SubmissionForReview {
  id: string;
  ownerLabel: string;
  status: SubmissionStatus;
  latestNote: string | null;
  latestAssets: { assetType: string; url: string | null }[];
  versionCount: number;
}

export function ReviewList({
  assignmentId,
  submissions,
  isOverrideReview,
  readOnly,
}: {
  assignmentId: string;
  submissions: SubmissionForReview[];
  isOverrideReview: boolean;
  /** Section 4.2 "Track only" (Mentor SV) / "Comment for own group" (Mentor ZPS) — view the list, no review actions. */
  readOnly?: boolean;
}) {
  if (submissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bài nộp</CardTitle>
          <CardDescription>Chưa có bài nộp nào.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bài nộp ({submissions.length})</CardTitle>
        {isOverrideReview && (
          <CardDescription>
            Bạn đang review thay Trainer phụ trách — cần nhập lý do (ghi vào audit log).
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {submissions.map((s) => (
          <SubmissionRow
            key={s.id}
            assignmentId={assignmentId}
            submission={s}
            isOverrideReview={isOverrideReview}
            readOnly={readOnly}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function SubmissionRow({
  assignmentId,
  submission,
  isOverrideReview,
  readOnly,
}: {
  assignmentId: string;
  submission: SubmissionForReview;
  isOverrideReview: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState<"needs_revision" | "completed" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const canReviewNow = !readOnly && (submission.status === "locked" || isOverrideReview);

  async function handleReview(decision: "needs_revision" | "completed") {
    setPending(decision);
    setError(null);
    const result = await reviewSubmission(assignmentId, submission.id, decision, reason);
    setPending(null);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-text-primary">{submission.ownerLabel}</span>
        <SubmissionStatusBadge status={submission.status} />
      </div>
      <p className="mt-1 text-[11px] text-text-secondary">{submission.versionCount} version</p>
      {submission.latestNote && <p className="mt-1.5 text-[12.5px] text-text-secondary">{submission.latestNote}</p>}
      {submission.latestAssets.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {submission.latestAssets.map((a, i) => (
            <a
              key={i}
              href={a.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-orange-3 hover:underline"
            >
              {SUBMISSION_ASSET_TYPE_LABELS[a.assetType as keyof typeof SUBMISSION_ASSET_TYPE_LABELS] ?? a.assetType}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}

      {canReviewNow && (
        <div className="mt-2.5 space-y-2 border-t border-border pt-2.5">
          {isOverrideReview && (
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Lý do override (tối thiểu 5 ký tự)…"
              className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[12px] text-text-primary outline-none focus:border-brand-orange-2"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending !== null}
              onClick={() => handleReview("needs_revision")}
            >
              {pending === "needs_revision" ? "…" : "Yêu cầu chỉnh sửa"}
            </Button>
            <Button type="button" size="sm" disabled={pending !== null} onClick={() => handleReview("completed")}>
              {pending === "completed" ? "…" : "Hoàn thành"}
            </Button>
          </div>
          {error && <p className="text-[11px] font-medium text-risk">{error}</p>}
        </div>
      )}
    </div>
  );
}
