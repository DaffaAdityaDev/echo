"use client";

import Markdown from "@/components/Markdown";
import type { ThoughtStep } from "../../types";

interface ReasoningStepProps {
  step: ThoughtStep;
  isStreaming?: boolean;
}

export function ReasoningStep({ step, isStreaming }: ReasoningStepProps) {
  return (
    <div className="text-xs text-muted border-l-2 border-accent/30 pl-3 py-1 bg-surface rounded-r-sm">
      <Markdown content={step.content || ""} className="prose-xs" isStreaming={isStreaming} />
    </div>
  );
}
