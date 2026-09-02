import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { GROUP_HEALTH_LABELS } from "@/lib/constants/statuses";
import type { GroupHealthInfo } from "@/lib/attendance/queries";
import { cn } from "@/lib/utils";

const HEALTH_VARIANT = {
  on_track: "success",
  need_attention: "warning",
} as const;

export function GroupHealthGrid({ groups }: { groups: GroupHealthInfo[] }) {
  if (groups.length === 0) {
    return <p className="text-[13px] text-text-secondary">Chưa có nhóm nào trong chương trình.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {groups.map((g) => (
        <Link
          key={g.id}
          href={`/app/groups/${g.id}` as never}
          title={g.reasons.join(" ")}
          className={cn(
            "rounded-xl border border-border bg-background p-3 transition-colors hover:border-brand-orange-2/60"
          )}
        >
          <p className="text-[13px] font-bold text-text-primary">{g.name}</p>
          <p className="text-[11px] text-text-secondary">{g.memberCount} sinh viên</p>
          <Badge variant={HEALTH_VARIANT[g.health]} className="mt-2">
            {GROUP_HEALTH_LABELS[g.health]}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
