"use client";

import { Search } from "lucide-react";
import type { ThoughtStep } from "../../types";

interface ToolCallStepProps {
  step: ThoughtStep;
}

export function ToolCallStep({ step }: ToolCallStepProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-accent-soft border border-accent/20 px-3 py-2">
      <div className="flex items-center gap-2 text-2xs font-bold text-accent uppercase tracking-wider">
        <Search className="h-3 w-3" aria-hidden="true" />
        <span className="break-all">Tool Action: {step.toolName}</span>
      </div>
      {step.toolInput && (
        <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-surface text-foreground border border-border p-2 rounded-sm">
          {JSON.stringify(step.toolInput, null, 2)}
        </pre>
      )}
    </div>
  );
}
