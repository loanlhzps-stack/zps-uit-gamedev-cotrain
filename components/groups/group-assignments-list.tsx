import Link from "next/link";
import { AssignmentStatusBadge } from "@/components/assignments/status-badges";
import { formatDueAt, formatDueRelative } from "@/lib/format/assignments";
import type { AssignmentListItem } from "@/lib/assignments/queries";

/**
 * "Bài tập" tab (Course Assignment half) — read-only, links out to the
 * existing detail/review/submission page rather than duplicating it
 * (reuse-not-rebuild, see lib/groups/queries.ts header).
 */
export function GroupAssignmentsList({
  assignments,
  emptyText = "Nhóm chưa có Bài tập nào.",
}: {
  assignments: AssignmentListItem[];
  emptyText?: string;
}) {
  if (assignments.length === 0) {
    return <p className="text-[13px] text-text-secondary">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {assignments.map((a) => (
        <li key={a.id}>
          <Link
            href={`/app/assignments/${a.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 transition-colors hover:border-brand-orange-2/60"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-text-primary">{a.title}</p>
              <p className="text-[11.5px] text-text-secondary">
                {a.createdByName}
                {a.dueAt && ` · Hạn ${formatDueAt(a.dueAt)} (${formatDueRelative(a.dueAt)})`}
              </p>
            </div>
            <AssignmentStatusBadge status={a.status} dueAt={a.dueAt} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
