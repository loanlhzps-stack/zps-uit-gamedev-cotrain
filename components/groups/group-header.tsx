"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GROUP_HEALTH_LABELS, type GroupHealth } from "@/lib/constants/statuses";
import { updateGroupIdentity } from "@/lib/actions/groups";

const HEALTH_VARIANT: Record<GroupHealth, "success" | "warning"> = {
  on_track: "success",
  need_attention: "warning",
};

/**
 * Section 13.1 — group identity (name/image), mentors, member count and
 * health badge. `canEdit` is `canEditIdentity` from
 * lib/groups/access.ts — Owner/Co-owner or a STUDENT member only
 * (mentors excluded, matching groups_update RLS).
 */
export function GroupHeader({
  groupId,
  name,
  imageUrl,
  memberCount,
  mentorZpsName,
  mentorStudentName,
  health,
  reasons,
  canEdit,
  updatedAt,
  lastUpdatedByName,
}: {
  groupId: string;
  name: string;
  imageUrl: string | null;
  memberCount: number;
  mentorZpsName: string | null;
  mentorStudentName: string | null;
  health: GroupHealth | null;
  reasons: string[];
  canEdit: boolean;
  updatedAt: string;
  lastUpdatedByName: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);

  // Section 20 — unsaved-change protection: warn on tab close/reload
  // once the identity form has an actual edit, not just opened (App
  // Router has no built-in in-app route-change confirmation short of a
  // much bigger custom router wrapper, so this covers close/reload
  // only).
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
    const result = await updateGroupIdentity(groupId, formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDirty(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="size-14 rounded-xl border border-border object-cover" />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-lg font-extrabold text-text-secondary">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-lg font-extrabold text-text-primary">{name}</h2>
            <p className="text-[12.5px] text-text-secondary">
              {memberCount} sinh viên · Mentor ZPS: {mentorZpsName ?? "—"} · Mentor SV: {mentorStudentName ?? "—"}
            </p>
            {health && (
              <Badge variant={HEALTH_VARIANT[health]} className="mt-2" title={reasons.join(" ")}>
                {GROUP_HEALTH_LABELS[health]}
              </Badge>
            )}
            {lastUpdatedByName && (
              <p className="mt-1 text-[11px] text-text-secondary">
                Sửa lần cuối bởi {lastUpdatedByName} · {new Date(updatedAt).toLocaleString("vi-VN")}
              </p>
            )}
          </div>
        </div>

        {canEdit &&
          (editing ? (
            <form onSubmit={handleSubmit} onChange={() => setDirty(true)} className="flex flex-col gap-2 sm:w-64">
              <input type="hidden" name="updatedAt" value={updatedAt} />
              <div>
                <label htmlFor="ghName" className="mb-1 block text-[11.5px] font-semibold text-text-primary">
                  Tên nhóm
                </label>
                <input
                  id="ghName"
                  name="name"
                  defaultValue={name}
                  required
                  className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
                />
              </div>
              <div>
                <label htmlFor="ghImageUrl" className="mb-1 block text-[11.5px] font-semibold text-text-primary">
                  Link ảnh nhóm
                </label>
                <input
                  id="ghImageUrl"
                  name="imageUrl"
                  type="url"
                  defaultValue={imageUrl ?? ""}
                  placeholder="https://…"
                  className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-text-primary outline-none focus:border-brand-orange-2"
                />
              </div>
              {error && <p className="text-[11px] font-medium text-risk">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Đang lưu…" : "Lưu"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDirty(false);
                    setEditing(false);
                  }}
                  disabled={pending}
                >
                  Huỷ
                </Button>
              </div>
            </form>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Cập nhật thông tin nhóm
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}
