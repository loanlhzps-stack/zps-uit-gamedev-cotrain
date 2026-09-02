import Link from "next/link";
import type { DeadlineItem } from "@/lib/assignments/queries";
import { formatDueAt, formatDueRelative } from "@/lib/format/assignments";

export function DeadlineList({ items, href = "/app/assignments" }: { items: DeadlineItem[]; href?: string }) {
  if (items.length === 0) {
    return <p className="text-[13px] text-text-secondary">Không có deadline nào sắp tới.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((d) => (
        <li key={d.id}>
          <Link
            href={href}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:border-brand-orange-2/60"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-text-primary">{d.title}</p>
              <p className="text-[11px] text-text-secondary">
                {d.scope} · {formatDueAt(d.dueAt)}
              </p>
            </div>
            <span className="shrink-0 text-[12px] font-bold text-brand-orange-3">{formatDueRelative(d.dueAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
