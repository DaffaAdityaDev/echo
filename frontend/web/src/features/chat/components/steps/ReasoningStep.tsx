"use client";

import Markdown from "@/components/Markdown";
import type { ThoughtStep } from "../../types";

interface ReasoningStepProps {
  step: ThoughtStep;
  isStreaming?: boolean;
}

export function ReasoningStep({ step, isStreaming }: ReasoningStepProps) {
  return (
    <div className="text-xs text-zinc-600 dark:text-zinc-400 border-l-2 border-purple-500/30 pl-3 py-1 bg-zinc-50 dark:bg-zinc-950/40 rounded-r-lg">
      <Markdown content={step.content || ""} className="prose-xs" isStreaming={isStreaming} />
    </div>
  );
}
