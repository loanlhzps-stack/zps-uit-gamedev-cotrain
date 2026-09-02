"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PROJECT_MILESTONE_STAGES,
  PROJECT_MILESTONE_STAGE_LABELS,
  PROJECT_MILESTONE_STATUSES,
  PROJECT_MILESTONE_STATUS_LABELS,
  PROJECT_MILESTONE_STATUS_VARIANT,
  type ProjectMilestoneStage,
  type ProjectMilestoneStatus,
} from "@/lib/constants/statuses";
import { updateProjectMilestone } from "@/lib/actions/groups";
import { formatSessionDate } from "@/lib/format/schedule";

export interface ProjectProgressValue {
  milestoneStage: ProjectMilestoneStage;
  milestoneStatus: ProjectMilestoneStatus;
  milestoneNextGoal: string | null;
  milestoneDeadline: string | null;
  updatedAt: string;
}

/**
 * "Tiến độ dự án" subtab (theo yêu cầu của bạn) — thay hẳn 1 ô nhập
 * text tự do "Milestone hiện tại" bằng hành trình cố định 8 giai đoạn
 * (`PROJECT_MILESTONE_STAGES`), có highlight giai đoạn hiện tại, kèm
 * trạng thái/mục tiêu tiếp theo/deadline.
 */
export function ProjectProgress({ groupId, value, canEdit }: { groupId: string; value: ProjectProgressValue; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);

  if (editing && canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tiến độ dự án</CardTitle>
          <CardDescription>Giai đoạn hiện tại trong hành trình, trạng thái, mục tiêu tiếp theo và deadline.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProgressEditForm
            groupId={groupId}
            value={value}
            onDone={() => {
              setEditing(false);
              router.refresh();
            }}
            onCancel={() => setEditing(false)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tiến độ dự án</CardTitle>
        <CardDescription>Giai đoạn hiện tại trong hành trình, trạng thái, mục tiêu tiếp theo và deadline.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MilestoneJourney currentStage={value.milestoneStage} />

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Trạng thái</p>
            <Badge variant={PROJECT_MILESTONE_STATUS_VARIANT[value.milestoneStatus]} className="mt-1">
              {PROJECT_MILESTONE_STATUS_LABELS[value.milestoneStatus]}
            </Badge>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Deadline</p>
            <p className="mt-1 text-[13px] font-semibold text-text-primary">
              {value.milestoneDeadline ? formatSessionDate(value.milestoneDeadline) : "Chưa đặt"}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Mục tiêu tiếp theo</p>
          <p className="mt-1 text-[13px] text-text-primary">{value.milestoneNextGoal || "Chưa đặt mục tiêu tiếp theo."}</p>
        </div>

        {canEdit && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Cập nhật tiến độ
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function MilestoneJourney({ currentStage }: { currentStage: ProjectMilestoneStage }) {
  const currentIndex = PROJECT_MILESTONE_STAGES.indexOf(currentStage);
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Hành trình dự án">
      {PROJECT_MILESTONE_STAGES.map((stage, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <li key={stage} className="flex items-center gap-1.5">
            <span
              className={
                isCurrent
                  ? "rounded-full bg-brand-gradient px-2.5 py-1 text-[11.5px] font-bold text-white shadow-sm"
                  : isPast
                    ? "rounded-full bg-success/10 px-2.5 py-1 text-[11.5px] font-semibold text-success"
                    : "rounded-full bg-background px-2.5 py-1 text-[11.5px] font-medium text-text-secondary"
              }
            >
              {PROJECT_MILESTONE_STAGE_LABELS[stage]}
            </span>
            {i < PROJECT_MILESTONE_STAGES.length - 1 && (
              <span className="text-[11px] text-text-secondary" aria-hidden="true">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ProgressEditForm({
  groupId,
  value,
  onDone,
  onCancel,
}: {
  groupId: string;
  value: ProjectProgressValue;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await updateProjectMilestone(groupId, formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="updatedAt" value={value.updatedAt} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div>
          <label htmlFor="milestoneStage" className="mb-1 block text-[12px] font-semibold text-text-primary">
            Giai đoạn hiện tại
          </label>
          <select
            id="milestoneStage"
            name="milestoneStage"
            defaultValue={value.milestoneStage}
            className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
          >
            {PROJECT_MILESTONE_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {PROJECT_MILESTONE_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="milestoneStatus" className="mb-1 block text-[12px] font-semibold text-text-primary">
            Trạng thái
          </label>
          <select
            id="milestoneStatus"
            name="milestoneStatus"
            defaultValue={value.milestoneStatus}
            className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
          >
            {PROJECT_MILESTONE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PROJECT_MILESTONE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="milestoneNextGoal" className="mb-1 block text-[12px] font-semibold text-text-primary">
          Mục tiêu tiếp theo
        </label>
        <textarea
          id="milestoneNextGoal"
          name="milestoneNextGoal"
          rows={2}
          defaultValue={value.milestoneNextGoal ?? ""}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
        />
      </div>
      <div>
        <label htmlFor="milestoneDeadline" className="mb-1 block text-[12px] font-semibold text-text-primary">
          Deadline
        </label>
        <input
          id="milestoneDeadline"
          name="milestoneDeadline"
          type="date"
          defaultValue={value.milestoneDeadline ?? ""}
          className="h-10 rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
        />
      </div>
      {error && <p className="text-[11px] font-medium text-risk">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={pending}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}
