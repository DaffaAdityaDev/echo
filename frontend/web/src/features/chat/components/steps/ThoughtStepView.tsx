"use client";

import { PACKET_TYPES } from "../../constants";
import type { ThoughtStep } from "../../types";
import { ReasoningStep } from "./ReasoningStep";
import { SubagentStep } from "./SubagentStep";
import { TodosStep } from "./TodosStep";
import { ToolCallStep } from "./ToolCallStep";
import { ToolResultStep } from "./ToolResultStep";

interface ThoughtStepViewProps {
  step: ThoughtStep;
  isStreaming?: boolean;
}

export function ThoughtStepView({ step, isStreaming }: ThoughtStepViewProps) {
  if (step.type === PACKET_TYPES.REASONING) {
    return <ReasoningStep step={step} isStreaming={isStreaming} />;
  }

  if (step.type === PACKET_TYPES.TOOL_CALL) {
    return <ToolCallStep step={step} />;
  }

  if (step.type === PACKET_TYPES.TOOL_RESULT) {
    return <ToolResultStep step={step} />;
  }

  if (step.type === PACKET_TYPES.TODO && step.todos) {
    return <TodosStep step={step} />;
  }

  if ((step.type === PACKET_TYPES.SUBAGENT_CALL || step.type === PACKET_TYPES.SUBAGENT_RESULT) && step.subagent) {
    return <SubagentStep step={step} />;
  }

  return null;
}
