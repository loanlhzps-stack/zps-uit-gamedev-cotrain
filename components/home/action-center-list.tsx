import Link from "next/link";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionCenterItem {
  id: string;
  label: string;
  href: string;
  severity: "warning" | "risk";
}

export function ActionCenterList({ items }: { items: ActionCenterItem[] }) {
  if (items.length === 0) {
    return <p className="text-[13px] text-text-secondary">Không có việc cần chú ý ngay.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const Icon = item.severity === "risk" ? OctagonAlert : AlertTriangle;
        return (
          <li key={item.id}>
            <Link
              href={item.href as never}
              className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:border-brand-orange-2/60"
            >
              <Icon
                className={cn("mt-0.5 size-4 shrink-0", item.severity === "risk" ? "text-risk" : "text-warning")}
                aria-hidden="true"
              />
              <span className="text-[13px] text-text-primary">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
