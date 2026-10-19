"use client";

import { CheckCircle2 } from "lucide-react";
import type { ThoughtStep } from "../../types";

interface ToolResultStepProps {
  step: ThoughtStep;
}

export function ToolResultStep({ step }: ToolResultStepProps) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-success/5 border border-success/20 px-3 py-2">
      <div className="flex items-center gap-2 text-2xs font-bold text-success uppercase tracking-wider">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        <span className="break-all">Observation: {step.toolName}</span>
      </div>
      <p className="text-xs text-muted leading-relaxed max-h-32 overflow-y-auto break-words">{step.content}</p>
    </div>
  );
}
