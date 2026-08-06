import { PACKET_TYPES } from "../constants";
import { useChatStore } from "../stores/chatStore";
import type { Message, MissionMeta, StreamPacket, SystemNotice, ThoughtStep } from "../types";

export interface ApplyPacketOptions {
  replay?: boolean;
}

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

export function applyStreamPacket(data: StreamPacket, opts: ApplyPacketOptions = {}): void {
  const { replay = false } = opts;
  const store = useChatStore.getState();

  store.appendPacketLog(data);

  const currentMsgs = store.messages;
  if (currentMsgs.length === 0) return;

  const lastIdx = currentMsgs.length - 1;
  const lastMessage: Message = {
    ...currentMsgs[lastIdx],
    steps: [...(currentMsgs[lastIdx].steps || [])],
  };

  switch (data.type) {
    case PACKET_TYPES.METADATA: {
      const meta: MissionMeta = data.meta || {
        strategy: data.strategy,
        historyDepth: data.historyDepth,
        toolsAvailable: data.toolsAvailable,
        objective: data.objective,
        maxIterations: data.maxIterations,
      };
      lastMessage.meta = meta;
      store.setMissionMeta(meta);
      break;
    }
    case PACKET_TYPES.DEBUG:
      store.appendDebugInfo({
        systemPrompt: data.rawSystemPrompt,
        historyLength: data.currentHistoryLength,
        rawMessages: data.rawMessages,
        missionId: data.missionId,
        timestamp: data.timestamp,
      });
      break;
    case PACKET_TYPES.USAGE:
      if (data.usage) {
        lastMessage.usage = data.usage;
        store.setCumulativeUsage(data.usage);
      }
      break;
    case PACKET_TYPES.REASONING: {
      if (replay) break;
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
      break;
    }
    case PACKET_TYPES.TOOL_CALL:
      pushStep(
        lastMessage,
        { type: PACKET_TYPES.TOOL_CALL, toolName: data.toolName, toolInput: data.toolInput },
        replay,
      );
      break;
    case PACKET_TYPES.TOOL_RESULT:
      pushStep(lastMessage, { type: PACKET_TYPES.TOOL_RESULT, toolName: data.toolName, content: data.content }, replay);
      break;
    case PACKET_TYPES.TODO:
      pushStep(lastMessage, { type: PACKET_TYPES.TODO, todos: data.todos }, replay);
      break;
    case PACKET_TYPES.SUBAGENT_CALL:
      pushStep(lastMessage, { type: PACKET_TYPES.SUBAGENT_CALL, subagent: data.subagent }, replay);
      break;
    case PACKET_TYPES.SUBAGENT_RESULT:
      pushStep(lastMessage, { type: PACKET_TYPES.SUBAGENT_RESULT, subagent: data.subagent }, replay);
      break;
    case PACKET_TYPES.FILE_OPERATION:
      pushStep(lastMessage, { type: PACKET_TYPES.FILE_OPERATION, fileOp: data.fileOp }, replay);
      break;
    case PACKET_TYPES.SWARM_STATUS:
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
      pushStep(lastMessage, { type: PACKET_TYPES.SWARM_STATUS, swarm: data.swarm }, replay);
      break;
    case PACKET_TYPES.HEARTBEAT:
      if (data.agentStatus) {
        store.setAgentProgress((prev) =>
          prev
            ? { ...prev, agentStatus: data.agentStatus }
            : { iteration: 0, totalIterations: 0, agentStatus: data.agentStatus },
        );
      }
      break;
    case PACKET_TYPES.STATE_CHANGE: {
      const nextState = (data.to || data.agentStatus?.state) as string | undefined;
      if (nextState) {
        store.setAgentState(nextState as never);
        pushStep(lastMessage, { type: "state_change", content: `State changed to ${nextState}` }, replay);
      }
      break;
    }
    case PACKET_TYPES.DEGRADED:
      store.setAgentState("degraded");
      pushStep(lastMessage, { type: "state_change", content: data.reason || "Agent is in degraded state" }, replay);
      break;
    case PACKET_TYPES.TOOL_SKIP:
      pushStep(lastMessage, { type: "tool_skip", toolName: data.toolName, content: "Skipped (circuit open)" }, replay);
      break;
    case PACKET_TYPES.PROGRESS:
      if (typeof data.step === "number") {
        const step = data.step;
        store.setAgentProgress((prev) =>
          prev ? { ...prev, iteration: step } : { iteration: step, totalIterations: 0 },
        );
      }
      break;
    case PACKET_TYPES.TURN_COMPLETE:
      if (data.usage) {
        lastMessage.usage = data.usage;
        store.setCumulativeUsage(data.usage);
      }
      store.setAgentState("completed");
      break;
    case PACKET_TYPES.ERROR: {
      const errDetail = data.content || "Stream execution failed";
      const currentContent = lastMessage.content || "";
      lastMessage.content = currentContent ? `${currentContent}\n\n[Error: ${errDetail}]` : `Error: ${errDetail}`;
      store.setAgentState("error");
      break;
    }
    case PACKET_TYPES.SYSTEM_NOTICE: {
      const notice: SystemNotice = {
        id: crypto.randomUUID(),
        level: data.payload.level,
        code: data.payload.code,
        message: data.payload.message,
        timestamp: Date.now(),
      };
      store.appendSystemNotice(notice);
      break;
    }
    case PACKET_TYPES.HITL_APPROVAL_REQUIRED: {
      const expiresAt = data.payload.expiresAt;
      if (replay && expiresAt && Date.now() > expiresAt) break;
      store.setHitlPendingApproval({
        approvalId: data.payload.approvalId,
        toolName: data.payload.toolName,
        args: data.payload.args,
        riskLevel: data.payload.riskLevel,
        expiresAt,
        missionId: data.missionId,
      });
      break;
    }
    case PACKET_TYPES.TOKEN_METRICS:
      if (data.payload) {
        store.setCumulativeUsage({
          promptTokens: data.payload.promptTokens,
          completionTokens: data.payload.completionTokens,
          totalTokens: data.payload.totalTokens,
          cachedTokens: data.payload.cachedTokens,
        });
      }
      break;
    case PACKET_TYPES.MISSION_COMPLETED:
      store.setAgentState("completed");
      break;
    default: {
      if (replay) break;
      const streamRecord = data as unknown as {
        choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
        content?: string;
        reasoning_content?: string;
      };
      const delta = streamRecord.choices?.[0]?.delta || streamRecord;
      const content = delta.content || "";
      const reasoning = delta.reasoning_content || "";

      if (reasoning) {
        const lastStep = lastMessage.steps[lastMessage.steps.length - 1];
        if (lastStep?.type === PACKET_TYPES.REASONING) {
          lastMessage.steps[lastMessage.steps.length - 1] = {
            ...lastStep,
            content: (lastStep.content || "") + reasoning,
          };
        } else {
          lastMessage.steps.push({ type: PACKET_TYPES.REASONING, content: reasoning });
        }
      }
      if (content) {
        lastMessage.content = (lastMessage.content || "") + content;
      }
    }
  }

  const nextMsgs = [...currentMsgs];
  nextMsgs[nextMsgs.length - 1] = lastMessage;
  store.setMessages(nextMsgs);
}
