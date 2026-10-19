"use client";

import { Terminal } from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/utils/cn";
import type { ThoughtStep } from "../../types";

const Markdown = dynamic(() => import("@/components/Markdown"), {
  ssr: false,
  loading: () => <div className="h-4 w-48 bg-surface-hover rounded-sm animate-pulse" />,
});

interface SubagentStepProps {
  step: ThoughtStep;
}

export function SubagentStep({ step }: SubagentStepProps) {
  if (!step.subagent) return null;

  const s = step.subagent;
  const isCalling = s.status === "calling";
  const isFailed = s.status === "failed";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border px-3.5 py-3 transition-all",
        isCalling
          ? "bg-accent-soft border-accent/20"
          : isFailed
            ? "bg-danger/5 border-danger/20"
            : "bg-success/5 border-success/20",
      )}
    >
      <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-foreground border-b border-border pb-2">
        <Terminal className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        <span className="min-w-0 break-all">Sub-Agent Delegation: {s.name}</span>
        <span className="ml-auto text-2xs font-semibold px-2 py-0.5 rounded-sm uppercase bg-accent/10 text-accent shrink-0">
          {s.status}
        </span>
      </div>
      <p className="text-xs text-foreground italic bg-surface p-2 rounded-sm border border-border">{s.instruction}</p>
      {s.result && (
        <div className="bg-surface text-foreground border border-border p-2.5 rounded-sm text-xs font-mono max-h-36 overflow-y-auto">
          <Markdown content={s.result} />
        </div>
      )}
    </div>
  );
}
