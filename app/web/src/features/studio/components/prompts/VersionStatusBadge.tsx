"use client";

import { cn } from "@/utils/cn";
import type { VersionStatus } from "../../types";

const STATUS_MAP: Record<VersionStatus, { label: string; style: string }> = {
  draft: {
    label: "Draft",
    style: "bg-surface-hover text-muted border-border",
  },
  in_review: { label: "In Review", style: "bg-warning/10 text-warning border-warning/30" },
  approved: { label: "Approved", style: "bg-accent/10 text-accent border-accent/30" },
  production: {
    label: "Production",
    style: "bg-success/15 text-success border-success/40 font-bold",
  },
  rolled_back: { label: "Rolled Back", style: "bg-danger/10 text-danger border-danger/30" },
};

export function VersionStatusBadge({ status }: { status: VersionStatus }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.draft;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm text-2xs font-extrabold uppercase tracking-wider border shrink-0 whitespace-nowrap",
        cfg.style,
      )}
    >
      {cfg.label}
    </span>
  );
}
