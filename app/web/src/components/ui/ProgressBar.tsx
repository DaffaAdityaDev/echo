import { cn } from "@/utils/cn";

interface ProgressBarProps {
  value: number;
  barClassName?: string;
  label?: string;
}

export function ProgressBar({ value, barClassName, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(value, 100));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className="w-full bg-surface-hover h-2.5 rounded-full overflow-hidden border border-border"
    >
      <div
        className={cn("h-full rounded-full bg-accent transition-all duration-500", barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
