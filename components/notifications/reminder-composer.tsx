"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sendReminder } from "@/lib/actions/notifications";

export interface ReminderComposerProps {
  mode: "owner" | "trainer" | "mentor";
  groups: { id: string; name: string }[];
  students: { id: string; name: string; groupName: string | null }[];
  assignments: { id: string; title: string }[];
}

type OwnerScope = "program" | "group" | "students" | "assignment_pending";

/**
 * Section 16.1 — "Owner/Co-owner can send targeted reminders. Trainer
 * can remind targets of owned assignments. Mentors can remind members
 * of their own group." `mode` picks which of the 3 shapes to render;
 * the Server Action (lib/actions/notifications.ts) re-validates scope
 * independently of whatever this form submits.
 */
export function ReminderComposer({ mode, groups, students, assignments }: ReminderComposerProps) {
  const router = useRouter();
  const [scope, setScope] = React.useState<OwnerScope>("program");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    const result = await sendReminder(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    formRef.current?.reset();
    setSuccess(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gửi nhắc nhở</CardTitle>
        <CardDescription>
          {mode === "owner" && "Chọn phạm vi: toàn chương trình, một nhóm, sinh viên cụ thể, hoặc sinh viên chưa hoàn thành một bài tập."}
          {mode === "trainer" && "Nhắc những sinh viên đang ở trạng thái nháp/cần chỉnh sửa cho một bài tập bạn tạo."}
          {mode === "mentor" && "Nhắc toàn bộ thành viên nhóm bạn phụ trách."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          {mode === "owner" && (
            <>
              <div>
                <label htmlFor="scope" className="mb-1 block text-[12px] font-semibold text-text-primary">
                  Phạm vi
                </label>
                <select
                  id="scope"
                  name="scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as OwnerScope)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2 sm:w-72"
                >
                  <option value="program">Toàn chương trình</option>
                  <option value="group">Một nhóm</option>
                  <option value="students">Sinh viên cụ thể</option>
                  <option value="assignment_pending">Sinh viên chưa hoàn thành một bài tập</option>
                </select>
              </div>

              {scope === "group" && (
                <select
                  name="groupId"
                  required
                  className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2 sm:w-72"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}

              {scope === "students" && (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2.5">
                  {students.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-[12.5px] text-text-primary">
                      <input type="checkbox" name="profileIds" value={s.id} />
                      {s.name}
                      {s.groupName && <span className="text-text-secondary">· {s.groupName}</span>}
                    </label>
                  ))}
                </div>
              )}

              {scope === "assignment_pending" && (
                <select
                  name="assignmentId"
                  required
                  className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2 sm:w-72"
                >
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          {mode === "trainer" && (
            <select
              name="assignmentId"
              required
              className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2 sm:w-72"
            >
              {assignments.length === 0 ? (
                <option value="">Bạn chưa tạo bài tập nào</option>
              ) : (
                assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))
              )}
            </select>
          )}

          {mode === "mentor" && groups.length > 1 && (
            <select
              name="groupId"
              required
              className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2 sm:w-72"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          {mode === "mentor" && groups.length === 1 && (
            <>
              <input type="hidden" name="groupId" value={groups[0].id} />
              <p className="text-[12.5px] text-text-secondary">Nhóm: {groups[0].name}</p>
            </>
          )}
          {mode === "mentor" && groups.length === 0 && (
            <p className="text-[12.5px] text-text-secondary">Bạn chưa được gán vào nhóm nào.</p>
          )}

          <div>
            <label htmlFor="title" className="mb-1 block text-[12px] font-semibold text-text-primary">
              Tiêu đề
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder="Ví dụ: Nhắc nộp bài tập trước 20h hôm nay"
              className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
            />
          </div>
          <div>
            <label htmlFor="body" className="mb-1 block text-[12px] font-semibold text-text-primary">
              Nội dung (không bắt buộc)
            </label>
            <textarea
              id="body"
              name="body"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
              {error}
            </p>
          )}
          {success && <p className="text-[12px] font-medium text-success">Đã gửi nhắc nhở.</p>}

          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Đang gửi…" : "Gửi nhắc nhở"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
