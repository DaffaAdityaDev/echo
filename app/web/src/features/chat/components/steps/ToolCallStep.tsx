"use client";

import { Search } from "lucide-react";
import type { ThoughtStep } from "../../types";

interface ToolCallStepProps {
  step: ThoughtStep;
}

export function ToolCallStep({ step }: ToolCallStepProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-purple-500/5 border border-purple-500/10 px-3 py-2">
      <div className="flex items-center gap-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
        <Search className="h-3 w-3" />
        <span>Tool Action: {step.toolName}</span>
      </div>
      {step.toolInput && (
        <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-all bg-zinc-900/80 text-zinc-200 p-2 rounded-lg">
          {JSON.stringify(step.toolInput, null, 2)}
        </pre>
      )}
    </div>
  );
}
