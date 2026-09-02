"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createAssignment } from "@/lib/actions/assignments";

type TargetType = "program" | "group" | "profile";

export function CreateAssignmentForm({
  programId,
  isTrainer,
  sessionOptions,
  groupOptions,
  studentOptions,
}: {
  programId: string;
  isTrainer: boolean;
  sessionOptions: { id: string; label: string }[];
  groupOptions: { id: string; name: string }[];
  studentOptions: { id: string; name: string; groupName: string | null }[];
}) {
  const router = useRouter();
  const [targetType, setTargetType] = React.useState<TargetType>("program");
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<Set<string>>(new Set());
  const [selectedProfileIds, setSelectedProfileIds] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleProfile(id: string) {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await createAssignment(formData);
    // createAssignment redirect()s to the new assignment on success — it
    // only returns here when there was a validation/DB error.
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo Bài tập</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="programId" value={programId} />

          <div>
            <label htmlFor="title" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
              Tiêu đề
            </label>
            <input
              id="title"
              name="title"
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
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
              />
            </div>
            <div>
              <label htmlFor="submissionMode" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
                Hình thức nộp bài
              </label>
              <select
                id="submissionMode"
                name="submissionMode"
                defaultValue="individual"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
              >
                <option value="individual">Cá nhân</option>
                <option value="group">Theo nhóm</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="sessionId" className="mb-1.5 block text-[13px] font-semibold text-text-primary">
              Gắn với buổi học {isTrainer ? "" : "(không bắt buộc)"}
            </label>
            <select
              id="sessionId"
              name="sessionId"
              required={isTrainer}
              defaultValue=""
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-text-primary outline-none focus:border-brand-orange-2"
            >
              <option value="">{isTrainer ? "— Chọn buổi học —" : "— Không gắn buổi học cụ thể —"}</option>
              {sessionOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {isTrainer && sessionOptions.length === 0 && (
              <p className="mt-1 text-[12px] text-risk">Bạn chưa được gán buổi dạy nào — không thể tạo bài tập.</p>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-text-primary">Đối tượng</span>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ["program", "Toàn lớp"],
                  ["group", "Chọn nhóm"],
                  ["profile", "Chọn sinh viên"],
                ] as [TargetType, string][]
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
                  <input
                    type="radio"
                    name="targetType"
                    value={value}
                    checked={targetType === value}
                    onChange={() => setTargetType(value)}
                  />
                  {label}
                </label>
              ))}
            </div>

            {targetType === "group" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {groupOptions.length === 0 && <p className="text-[12px] text-text-secondary">Chưa có nhóm nào.</p>}
                {groupOptions.map((g) => (
                  <label
                    key={g.id}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-text-primary"
                  >
                    <input
                      type="checkbox"
                      name="targetGroupIds"
                      value={g.id}
                      checked={selectedGroupIds.has(g.id)}
                      onChange={() => toggleGroup(g.id)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            )}

            {targetType === "profile" && (
              <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                {studentOptions.length === 0 && <p className="text-[12px] text-text-secondary">Chưa có sinh viên nào.</p>}
                {studentOptions.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-text-primary"
                  >
                    <input
                      type="checkbox"
                      name="targetProfileIds"
                      value={s.id}
                      checked={selectedProfileIds.has(s.id)}
                      onChange={() => toggleProfile(s.id)}
                    />
                    {s.name}
                    {s.groupName && <span className="text-text-secondary">· {s.groupName}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2.5">
            <Button type="submit" size="sm" disabled={pending || (isTrainer && sessionOptions.length === 0)}>
              {pending ? "Đang tạo…" : "Tạo bài tập"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => router.back()}>
              Huỷ
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
