"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ASSIGNMENT_STATUSES, ASSIGNMENT_STATUS_LABELS, type AssignmentStatus } from "@/lib/constants/statuses";
import { updateAssignmentMeta, deleteAssignment } from "@/lib/actions/assignments";
import { toDatetimeLocalValue } from "@/lib/format/assignments";

export function AssignmentEditForm({
  assignmentId,
  programId,
  title,
  description,
  dueAt,
  status,
  isOwnerOrCo,
}: {
  assignmentId: string;
  programId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: AssignmentStatus;
  isOwnerOrCo: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    const result = await updateAssignmentMeta(assignmentId, formData);
    setPending(false);
    if (result.error) setError(result.error);
    else setSaved(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chỉnh sửa bài tập</CardTitle>
        <CardDescription>Chưa hỗ trợ sửa đối tượng nhắm tới sau khi tạo — tạo bài tập mới nếu cần đổi đối tượng.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="title" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
              Tiêu đề
            </label>
            <input
              id="title"
              name="title"
              defaultValue={title}
              required
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
            />
          </div>
          <div>
            <label htmlFor="description" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
              Mô tả
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={description ?? ""}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="dueAt" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                Deadline
              </label>
              <input
                id="dueAt"
                name="dueAt"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(dueAt)}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
              />
            </div>
            <div>
              <label htmlFor="status" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                Trạng thái
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
              >
                {ASSIGNMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ASSIGNMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
              {error}
            </p>
          )}
          {saved && !pending && (
            <p role="status" className="text-[12px] font-medium text-success">
              Đã lưu.
            </p>
          )}

          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu bài tập"}
          </Button>
        </form>

        {isOwnerOrCo && (
          <div className="border-t border-border pt-4">
            <DeleteAssignmentSection assignmentId={assignmentId} programId={programId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteAssignmentSection({ assignmentId, programId }: { assignmentId: string; programId: string }) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setPending(true);
    setError(null);
    const result = await deleteAssignment(assignmentId, programId);
    // deleteAssignment redirect()s to /app/assignments on success — this
    // only returns here when there was an error.
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div>
      <h3 className="mb-1 text-[13px] font-bold text-text-primary">Xoá bài tập</h3>
      <p className="mb-2 text-[12px] text-text-secondary">
        Xoá toàn bộ bài nộp, version và link đính kèm liên quan. Không thể hoàn tác.
      </p>
      <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={handleDelete}>
        {pending ? "Đang xoá…" : confirmDelete ? "Xác nhận xoá bài tập?" : "Xoá bài tập"}
      </Button>
      {error && <p className="mt-1.5 text-[11px] font-medium text-risk">{error}</p>}
    </div>
  );
}
