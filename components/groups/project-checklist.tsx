"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PROJECT_CHECKLIST_CATEGORIES,
  PROJECT_CHECKLIST_ITEM_STATUSES,
  PROJECT_CHECKLIST_ITEM_STATUS_LABELS,
  PROJECT_CHECKLIST_ITEM_STATUS_VARIANT,
  type ProjectChecklistItemStatus,
} from "@/lib/constants/statuses";
import { setProjectChecklistItemStatus } from "@/lib/actions/groups";

/**
 * "Checklist" subtab (theo yêu cầu của bạn) — 4 nhóm/15 mục cố định
 * (PROJECT_CHECKLIST_CATEGORIES, định nghĩa ở code, không lưu DB).
 * Mỗi mục có 1 dropdown 4 trạng thái, lưu ngay khi đổi (sparse: mục
 * chưa từng đổi coi như "not_started") — không có nút Lưu/Huỷ riêng
 * vì mỗi mục độc lập, không phải 1 form gộp.
 */
export function ProjectChecklist({
  groupId,
  checklist,
  canEdit,
}: {
  groupId: string;
  checklist: Record<string, ProjectChecklistItemStatus>;
  canEdit: boolean;
}) {
  const doneCount = PROJECT_CHECKLIST_CATEGORIES.flatMap((c) => c.items).filter(
    (item) => (checklist[item.key] ?? "not_started") === "done"
  ).length;
  const totalCount = PROJECT_CHECKLIST_CATEGORIES.flatMap((c) => c.items).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist</CardTitle>
        <CardDescription>
          {doneCount}/{totalCount} mục đã xong.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {PROJECT_CHECKLIST_CATEGORIES.map((category) => (
          <div key={category.key}>
            <p className="mb-2 text-[12.5px] font-bold text-text-primary">{category.label}</p>
            <ul className="space-y-2">
              {category.items.map((item) => (
                <ChecklistItemRow
                  key={item.key}
                  groupId={groupId}
                  itemKey={item.key}
                  label={item.label}
                  status={checklist[item.key] ?? "not_started"}
                  canEdit={canEdit}
                />
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ChecklistItemRow({
  groupId,
  itemKey,
  label,
  status,
  canEdit,
}: {
  groupId: string;
  itemKey: string;
  label: string;
  status: ProjectChecklistItemStatus;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as ProjectChecklistItemStatus;
    setPending(true);
    setError(null);
    const result = await setProjectChecklistItemStatus(groupId, itemKey, next);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-2">
        <Badge variant={PROJECT_CHECKLIST_ITEM_STATUS_VARIANT[status]}>
          {PROJECT_CHECKLIST_ITEM_STATUS_LABELS[status]}
        </Badge>
        <p className="text-[12.5px] text-text-primary">{label}</p>
      </div>
      {canEdit && (
        <select
          aria-label={`Trạng thái: ${label}`}
          value={status}
          disabled={pending}
          onChange={handleChange}
          className="h-8 shrink-0 rounded-lg border border-border bg-background px-2 text-[12px] text-text-primary outline-none focus:border-brand-orange-2"
        >
          {PROJECT_CHECKLIST_ITEM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_CHECKLIST_ITEM_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      )}
      {error && <p className="w-full text-[11px] font-medium text-risk">{error}</p>}
    </li>
  );
}
