import { cn } from "@/utils/cn";

interface ProgressBarProps {
  value: number;
  barClassName?: string;
}

export function ProgressBar({ value, barClassName }: ProgressBarProps) {
  return (
    <div className="w-full bg-zinc-200 dark:bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-300/60 dark:border-zinc-800">
      <div
        className={cn("h-full rounded-full transition-all duration-500", barClassName)}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}
