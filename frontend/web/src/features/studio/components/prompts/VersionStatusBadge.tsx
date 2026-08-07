"use client";

import { cn } from "@/utils/cn";
import type { VersionStatus } from "../../types";

const STATUS_MAP: Record<VersionStatus, { label: string; style: string }> = {
  draft: {
    label: "Draft",
    style: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
  },
  in_review: { label: "In Review", style: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  approved: { label: "Approved", style: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  production: {
    label: "Production",
    style: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold",
  },
  rolled_back: { label: "Rolled Back", style: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30" },
};

export function VersionStatusBadge({ status }: { status: VersionStatus }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border shrink-0 whitespace-nowrap",
        cfg.style,
      )}
    >
      {cfg.label}
    </span>
  );
}
