"use client";

import { Terminal } from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/utils/cn";
import type { ThoughtStep } from "../../types";

const Markdown = dynamic(() => import("@/components/Markdown"), {
  ssr: false,
  loading: () => <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />,
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
        "flex flex-col gap-2 rounded-xl border px-3.5 py-3 transition-all",
        isCalling
          ? "bg-purple-500/5 border-purple-500/20"
          : isFailed
            ? "bg-red-500/5 border-red-500/20"
            : "bg-emerald-500/5 border-emerald-500/20",
      )}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <Terminal className="h-3.5 w-3.5 text-purple-500" />
        <span>Sub-Agent Delegation: {s.name}</span>
        <span className="ml-auto text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase bg-purple-500/10 text-purple-500">
          {s.status}
        </span>
      </div>
      <p className="text-xs text-zinc-700 dark:text-zinc-300 italic bg-zinc-100 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
        {s.instruction}
      </p>
      {s.result && (
        <div className="bg-zinc-950 text-zinc-200 p-2.5 rounded-lg text-xs font-mono max-h-36 overflow-y-auto">
          <Markdown content={s.result} />
        </div>
      )}
    </div>
  );
}
