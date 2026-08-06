import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { AgentState, LLMProvider, Observation, Task, ToolDefinition } from "../../../shared/types";
import { logger } from "../../../shared/utils/logger";
import type { CircuitBreaker } from "./circuit_breaker";
import { compressObservation } from "./compressor";
import { HARNESS_CONFIG, OPERATION_STATUS } from "./constants";
import type { DegradationManager } from "./degradation";
import type { HarnessEventEmitter } from "./events";
import type { AgentStatusTracker } from "./status-tracker";
import type { HarnessEvent, HarnessRuntimeConfig } from "./types";

export interface ToolExecutorDeps {
  provider: LLMProvider;
  delegationDepth: number;
  harnessConfig?: HarnessRuntimeConfig;
  getPacingForced: () => boolean;
  getStatusTracker: () => AgentStatusTracker | undefined;
  emitter: HarnessEventEmitter;
}

export class ToolExecutor {
  constructor(private readonly deps: ToolExecutorDeps) {}

  async execute(
    pendingToolCall: { name: string; args: Record<string, unknown> },
    toolMap: Map<string, ToolDefinition>,
    assistantContent: string,
    reasoningContent: string,
    iteration: number,
    onPacket: (p: HarnessEvent) => Promise<void>,
    state: AgentState,
    circuit: CircuitBreaker,
    degradation: DegradationManager,
    totalInputTokensSum: number,
    maxContextTokens: number,
  ): Promise<{ isComplete: boolean }> {
    if (circuit.isOpen(pendingToolCall.name)) {
      logger.warn(`Circuit breaker is open for tool: ${pendingToolCall.name}, skipping execution.`, {
        missionId: state.missionId,
      });
      await this.deps.emitter.emitToolSkip(onPacket, iteration, pendingToolCall.name);
      degradation.recordToolError();
      state.messages.push(
        new AIMessage(
          `Tool ${pendingToolCall.name} is currently unavailable due to repeated failures. It has been skipped.`,
        ),
      );
      return { isComplete: false };
    }

    const tool = toolMap.get(pendingToolCall.name);
    if (!tool) {
      const reason = this.deps.getPacingForced() ? "pacing forced synthesis" : "tool not in map";
      logger.warn(`Tool not found: ${pendingToolCall.name} (${reason})`, { missionId: state.missionId });
      state.messages.push(
        new AIMessage({
          content: assistantContent,
          additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined,
        }),
      );
      return { isComplete: false };
    }

    logger.info(`Executing tool: ${pendingToolCall.name}`, { missionId: state.missionId });
    this.deps.getStatusTracker()?.update({ currentTool: pendingToolCall.name });

    await this.deps.emitter.emitToolCall(onPacket, iteration, pendingToolCall.name, pendingToolCall.args);

    if (pendingToolCall.name === "write_todos") {
      await this.deps.emitter.emitTodos(onPacket, iteration, pendingToolCall.args.todos);
      state.tasks = pendingToolCall.args.todos as Task[];
    } else if (pendingToolCall.name === "delegate_task") {
      await this.deps.emitter.emitSubagentCall(
        onPacket,
        iteration,
        pendingToolCall.args.agentName as string,
        pendingToolCall.args.instruction as string,
      );
    }

    let observation: Observation;
    try {
      observation = await tool.execute(pendingToolCall.args, {
        parentMessages: state.messages,
        onPacket,
        provider: this.deps.provider,
        tools: [...toolMap.values()],
        delegationDepth: this.deps.delegationDepth,
        missionId: state.missionId,
      });
    } catch (err: unknown) {
      const toolError = err as { message?: string };
      logger.error(`Tool execution failed for ${pendingToolCall.name}: ${toolError.message}`, err);
      observation = {
        status: OPERATION_STATUS.ERROR,
        summary: `Tool execution failed: Failed to perform ${pendingToolCall.name}. Please try again later or refine the request.`,
        error: "TOOL_EXECUTION_FAILED",
      };
    }

    const isError = observation.status === OPERATION_STATUS.ERROR;
    if (isError) {
      circuit.recordFailure(pendingToolCall.name);
      degradation.recordToolError();
      const failures = circuit.getState(pendingToolCall.name)?.failures ?? 1;
      const maxRetries =
        this.deps.harnessConfig?.circuitBreaker?.maxRetriesPerTool ??
        HARNESS_CONFIG.CIRCUIT_BREAKER.MAX_RETRIES_PER_TOOL;
      const isOpen = circuit.isOpen(pendingToolCall.name);
      observation = compressObservation(observation, failures, maxRetries, isOpen);
    } else {
      circuit.recordSuccess(pendingToolCall.name);
      degradation.reset();
    }

    if (pendingToolCall.name === "delegate_task") {
      await this.deps.emitter.emitSubagentResult(
        onPacket,
        iteration,
        pendingToolCall.args.agentName as string,
        pendingToolCall.args.instruction as string,
        observation.summary,
        observation.status === "success" ? "completed" : "failed",
      );
    }

    const toolCallId = `tool_${Date.now()}`;
    state.messages.push(
      new AIMessage({
        content: assistantContent,
        tool_calls: [{ id: toolCallId, name: pendingToolCall.name, args: pendingToolCall.args, type: "tool_call" }],
        additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined,
      }),
    );
    state.messages.push(new ToolMessage({ tool_call_id: toolCallId, content: observation.summary }));

    await this.deps.emitter.emitToolResult(
      onPacket,
      iteration,
      pendingToolCall.name,
      observation.summary,
      observation.data,
    );

    await this.deps.emitter.emitProgress(onPacket, iteration, "tool_execution", totalInputTokensSum, maxContextTokens);
    this.deps.getStatusTracker()?.update({ currentTool: undefined });

    return { isComplete: false };
  }
}
