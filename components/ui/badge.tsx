import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
  {
    variants: {
      variant: {
        neutral: "bg-background text-text-secondary border border-border",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        risk: "bg-risk/10 text-risk",
        info: "bg-info/10 text-info",
        brand: "bg-brand-orange-2/10 text-brand-orange-3",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dotClassName?: string;
}

export function Badge({ className, variant, dotClassName, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full bg-current opacity-70", dotClassName)}
      />
      {children}
    </span>
  );
}
