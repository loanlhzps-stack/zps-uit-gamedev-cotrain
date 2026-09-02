"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateGroupProject } from "@/lib/actions/groups";

export interface ProjectMetaValue {
  gameName: string | null;
  concept: string | null;
  imageUrl: string | null;
  updatedAt: string;
  lastUpdatedByName: string | null;
}

/**
 * "Thông tin dự án" subtab — chỉ còn tên game/ý tưởng/ảnh cover (theo
 * yêu cầu của bạn: "giữ nguyên subtab Thông tin dự án"). Milestone và
 * các link Repository/Build/Video trước đây nằm chung ở đây đã tách
 * ra 2 subtab riêng ("Tiến độ dự án", "Build và tài liệu" — xem
 * `ProjectMilestoneTracker`/`ProjectBuildsManager`), vì các link đó
 * giờ theo từng phiên bản build, không còn là 1 ô duy nhất ở đây.
 * Read-only cho Sponsor/Trainer (canEdit=false renders a plain summary
 * card instead of the form).
 */
export function ProjectMetaForm({ groupId, value, canEdit }: { groupId: string; value: ProjectMetaValue; canEdit: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);

  // Section 20 — unsaved-change protection (tab close/reload; App
  // Router has no built-in in-app route-change confirmation).
  React.useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await updateGroupProject(groupId, formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDirty(false);
    router.refresh();
  }

  if (!canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{value.gameName || "Chưa đặt tên game"}</CardTitle>
          <CardDescription>{value.concept || "Chưa có mô tả ý tưởng."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin dự án</CardTitle>
        <CardDescription>Tên game, ý tưởng và ảnh cover.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} onChange={() => setDirty(true)} className="space-y-3">
          <input type="hidden" name="updatedAt" value={value.updatedAt} />
          {value.lastUpdatedByName && (
            <p className="text-[11px] text-text-secondary">
              Sửa lần cuối bởi {value.lastUpdatedByName} · {new Date(value.updatedAt).toLocaleString("vi-VN")}
            </p>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field id="gameName" name="gameName" label="Tên game" defaultValue={value.gameName ?? ""} />
            <Field id="imageUrl" name="imageUrl" label="Link ảnh/cover" type="url" defaultValue={value.imageUrl ?? ""} />
          </div>
          <div>
            <label htmlFor="concept" className="mb-1 block text-[12px] font-semibold text-text-primary">
              Ý tưởng / concept
            </label>
            <textarea
              id="concept"
              name="concept"
              rows={3}
              defaultValue={value.concept ?? ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-risk/10 px-3 py-2 text-[12px] font-medium text-risk">
              {error}
            </p>
          )}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu thông tin dự án"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  name,
  label,
  defaultValue,
  type = "text",
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] font-semibold text-text-primary">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
      />
    </div>
  );
}
