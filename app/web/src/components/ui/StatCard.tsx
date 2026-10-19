import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "accent" | "warning";
  className?: string;
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  accent: "text-accent",
  warning: "text-warning",
};

export function StatCard({ label, value, hint, tone = "default", className }: StatCardProps) {
  return (
    <div className={cn("p-2.5 rounded-md bg-elevated border border-border", className)}>
      <span className="text-2xs text-muted block font-medium">{label}</span>
      <span className={cn("text-xs font-bold font-mono", TONES[tone])}>{value}</span>
      {hint && <span className="text-2xs text-muted block mt-0.5 font-mono">{hint}</span>}
    </div>
  );
}
