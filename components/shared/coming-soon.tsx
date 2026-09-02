import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

export function ComingSoonPage({
  title,
  description,
  phase,
  icon: Icon = Construction,
}: {
  title: string;
  description: string;
  phase: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand-orange-2/10 text-brand-orange-3">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-extrabold text-text-primary">{title}</h2>
          <p className="text-sm text-text-secondary">{description}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            {phase}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
