"use client";

import { CheckCircle2 } from "lucide-react";
import type { ThoughtStep } from "../../types";

interface ToolResultStepProps {
  step: ThoughtStep;
}

export function ToolResultStep({ step }: ToolResultStepProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
      <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
        <CheckCircle2 className="h-3 w-3" />
        <span>Observation: {step.toolName}</span>
      </div>
      <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed max-h-32 overflow-y-auto">
        {step.content}
      </p>
    </div>
  );
}
