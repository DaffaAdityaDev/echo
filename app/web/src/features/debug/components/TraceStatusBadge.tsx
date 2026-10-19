import { cn } from "@/utils/cn";
import type { Trace } from "../stores/traceStore";

const STATUS_CLASSES: Record<Trace["status"], string> = {
  streaming: "bg-success/10 text-success border-success/20",
  complete: "bg-accent/10 text-accent border-accent/20",
  error: "bg-danger/10 text-danger border-danger/20",
  interrupted: "bg-warning/10 text-warning border-warning/20",
};

interface TraceStatusBadgeProps {
  status: Trace["status"];
  withPulse?: boolean;
  className?: string;
}

export function TraceStatusBadge({ status, withPulse = false, className }: TraceStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-extrabold uppercase border whitespace-nowrap",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {withPulse && status === "streaming" && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
        </span>
      )}
      {status}
    </span>
  );
}
