import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "emerald" | "purple" | "blue" | "amber";
  className?: string;
}

const tones = {
  default: "text-zinc-900 dark:text-zinc-100",
  emerald: "text-emerald-600 dark:text-emerald-400",
  purple: "text-purple-700 dark:text-purple-300",
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400",
};

export function StatCard({ label, value, hint, tone = "default", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "p-2.5 rounded-xl bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80",
        className,
      )}
    >
      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">{label}</span>
      <span className={cn("text-xs font-bold font-mono", tones[tone])}>{value}</span>
      {hint && <span className="text-[9px] text-zinc-400 block mt-0.5 font-mono">{hint}</span>}
    </div>
  );
}
