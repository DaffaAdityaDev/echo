import type * as React from "react";
import { cn } from "@/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "verified" | "success" | "blocked" | "parameter" | "warning" | "danger";
}

const VARIANTS: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-surface-hover text-foreground border-border",
  outline: "bg-transparent text-muted border-border",
  verified: "bg-success/10 text-success border-success/30",
  success: "bg-success/10 text-success border-success/30",
  blocked: "bg-danger/10 text-danger border-danger/30",
  parameter: "bg-accent-soft text-accent border-accent/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/30",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-2xs font-mono font-semibold uppercase tracking-eyebrow transition-colors",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
