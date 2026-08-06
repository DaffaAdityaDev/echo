import { PACKET_TYPES } from "../../../constants";
import type { Message, StreamPacket, ThoughtStep } from "../../../types";
import type { StreamHandlerOptions, StreamStore, SubagentPacket } from "./types";

// Replayed history is already represented in the message rebuilt from the DB
// (which persists steps), so step packets are skipped during replay. During the
// live phase every packet is pushed — deduplicating here would collapse
// distinct tool calls (same tool, different inputs), subagent delegations, and
// repeated todo snapshots into a single step.
function pushStep(message: Message, step: ThoughtStep, replay: boolean): boolean {
  if (replay) return false;
  message.steps.push(step);
  return true;
}

export function handleReasoning(
  lastMessage: Message,
  data: StreamPacket & { type: "reasoning" },
  _store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  if (opts.replay) return;
  const reasoningText = data.content || "";
  if (reasoningText) {
    const lastStep = lastMessage.steps[lastMessage.steps.length - 1];
    if (lastStep?.type === PACKET_TYPES.REASONING) {
      lastMessage.steps[lastMessage.steps.length - 1] = {
        ...lastStep,
        content: (lastStep.content || "") + reasoningText,
      };
    } else {
      lastMessage.steps.push({ type: PACKET_TYPES.REASONING, content: reasoningText });
    }
  }
}

export function handleToolCall(
  lastMessage: Message,
  data: StreamPacket & { type: "tool_call" },
  _store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  pushStep(
    lastMessage,
    { type: PACKET_TYPES.TOOL_CALL, toolName: data.toolName, toolInput: data.toolInput },
    opts.replay,
  );
}

export function handleToolResult(
  lastMessage: Message,
  data: StreamPacket & { type: "tool_result" },
  _store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  pushStep(
    lastMessage,
    { type: PACKET_TYPES.TOOL_RESULT, toolName: data.toolName, content: data.content },
    opts.replay,
  );
}

export function handleTodo(
  lastMessage: Message,
  data: StreamPacket & { type: "todo" },
  _store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  pushStep(lastMessage, { type: PACKET_TYPES.TODO, todos: data.todos }, opts.replay);
}

export function handleSubagentCall(
  lastMessage: Message,
  data: SubagentPacket,
  _store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  pushStep(lastMessage, { type: PACKET_TYPES.SUBAGENT_CALL, subagent: data.subagent }, opts.replay);
}

export function handleSubagentResult(
  lastMessage: Message,
  data: SubagentPacket,
  _store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  pushStep(lastMessage, { type: PACKET_TYPES.SUBAGENT_RESULT, subagent: data.subagent }, opts.replay);
}

export function handleFileOperation(
  lastMessage: Message,
  data: StreamPacket & { type: "file_operation" },
  _store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  pushStep(lastMessage, { type: PACKET_TYPES.FILE_OPERATION, fileOp: data.fileOp }, opts.replay);
}

export function handleSwarmStatus(
  lastMessage: Message,
  data: StreamPacket & { type: "swarm_status" },
  store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  if (data.swarm) {
    store.setAgentProgress((prev) => {
      const currentSwarm = prev?.swarm || {
        activeUrls: {} as NonNullable<NonNullable<typeof prev>["swarm"]>["activeUrls"],
        scrapedCount: 0,
        failedCount: 0,
        factsCount: 0,
        discoveredCount: 0,
        discoveredUrls: [],
      };

      const updatedActiveUrls = { ...currentSwarm.activeUrls };
      if (data.swarm?.url) {
        const existing = updatedActiveUrls[data.swarm.url];
        updatedActiveUrls[data.swarm.url] = {
          url: data.swarm.url,
          status: data.swarm.status,
          attempt: data.swarm.attempt || existing?.attempt || 1,
          feedback: data.swarm.feedback || existing?.feedback,
          dataSize: data.swarm.dataSize || existing?.dataSize,
          factsCount: data.swarm.factsCount || existing?.factsCount,
        };
      }

      let newScraped = currentSwarm.scrapedCount;
      let newFailed = currentSwarm.failedCount;
      let newFacts = currentSwarm.factsCount;

      if (data.swarm?.status === "critic_passed" && data.swarm?.url) {
        if (currentSwarm.activeUrls[data.swarm.url]?.status !== "critic_passed") {
          newScraped += 1;
        }
        if (data.swarm.factsCount) {
          newFacts += data.swarm.factsCount;
        }
      } else if (data.swarm?.status === "scrape_failed" && data.swarm?.url) {
        if (currentSwarm.activeUrls[data.swarm.url]?.status !== "scrape_failed") {
          newFailed += 1;
        }
      }

      const newDiscoveredUrls = [...(currentSwarm.discoveredUrls || [])];
      if (data.swarm?.url && !newDiscoveredUrls.includes(data.swarm.url)) {
        newDiscoveredUrls.push(data.swarm.url);
      }

      return {
        iteration: prev?.iteration || 0,
        totalIterations: prev?.totalIterations || 0,
        currentTool: data.swarm?.status === "crawling" ? `crawling ${data.swarm?.url}` : undefined,
        statusMessage: data.swarm?.message,
        swarm: {
          status: data.swarm?.status,
          url: data.swarm?.url,
          activeUrls: updatedActiveUrls,
          scrapedCount: newScraped,
          failedCount: newFailed,
          factsCount: newFacts,
          discoveredCount: Math.max(currentSwarm.discoveredCount, newDiscoveredUrls.length),
          discoveredUrls: newDiscoveredUrls,
        },
      };
    });
  }
  pushStep(lastMessage, { type: PACKET_TYPES.SWARM_STATUS, swarm: data.swarm }, opts.replay);
}

export function handleToolSkip(
  lastMessage: Message,
  data: StreamPacket & { type: "tool_skip" },
  _store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  pushStep(lastMessage, { type: "tool_skip", toolName: data.toolName, content: "Skipped (circuit open)" }, opts.replay);
}

export function handleStateChange(
  lastMessage: Message,
  data: StreamPacket & { type: "state_change" },
  store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  const nextState = (data.to || data.agentStatus?.state) as string | undefined;
  if (nextState) {
    store.setAgentState(nextState as never);
    pushStep(lastMessage, { type: "state_change", content: `State changed to ${nextState}` }, opts.replay);
  }
}

export function handleDegraded(
  lastMessage: Message,
  data: StreamPacket & { type: "degraded" },
  store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  store.setAgentState("degraded");
  pushStep(lastMessage, { type: "state_change", content: data.reason || "Agent is in degraded state" }, opts.replay);
}
