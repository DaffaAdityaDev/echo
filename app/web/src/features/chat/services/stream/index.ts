import { useTraceStore } from "@/features/debug/stores/traceStore";
import { PACKET_TYPES } from "../../constants";
import { useChatStore } from "../../stores/chatStore";
import type { Message, StreamPacket } from "../../types";
import { handleTokenMetrics, handleUsage } from "./handlers/metrics";
import { handleDebug, handleDefault, handleHitlApproval, handleMetadata, handleSystemNotice } from "./handlers/misc";
import {
  handleError,
  handleHeartbeat,
  handleMissionCompleted,
  handleProgress,
  handleTurnComplete,
} from "./handlers/status";
import {
  handleDegraded,
  handleFileOperation,
  handleReasoning,
  handleStateChange,
  handleSubagentCall,
  handleSubagentResult,
  handleSwarmStatus,
  handleTodo,
  handleToolCall,
  handleToolResult,
  handleToolSkip,
} from "./handlers/steps";

export function applyStreamPacket(data: StreamPacket): void {
  // Capture trace
  useTraceStore.getState().addOrUpdateTraceFromPacket(data);

  const store = useChatStore.getState();

  store.appendPacketLog(data);

  const currentMsgs = store.messages;
  if (currentMsgs.length === 0) return;

  const lastIdx = currentMsgs.length - 1;
  const lastMessage: Message = {
    ...currentMsgs[lastIdx],
    steps: [...(currentMsgs[lastIdx].steps || [])],
    status: currentMsgs[lastIdx].status === "complete" ? "complete" : "streaming",
  };

  switch (data.type) {
    case PACKET_TYPES.METADATA:
      handleMetadata(lastMessage, data, store);
      break;
    case PACKET_TYPES.DEBUG:
      handleDebug(lastMessage, data, store);
      break;
    case PACKET_TYPES.USAGE:
      handleUsage(lastMessage, data, store);
      break;
    case PACKET_TYPES.REASONING:
      handleReasoning(lastMessage, data, store);
      break;
    case PACKET_TYPES.TOOL_CALL:
      handleToolCall(lastMessage, data, store);
      break;
    case PACKET_TYPES.TOOL_RESULT:
      handleToolResult(lastMessage, data, store);
      break;
    case PACKET_TYPES.TODO:
      handleTodo(lastMessage, data, store);
      break;
    case PACKET_TYPES.SUBAGENT_CALL:
      handleSubagentCall(lastMessage, data, store);
      break;
    case PACKET_TYPES.SUBAGENT_RESULT:
      handleSubagentResult(lastMessage, data, store);
      break;
    case PACKET_TYPES.FILE_OPERATION:
      handleFileOperation(lastMessage, data, store);
      break;
    case PACKET_TYPES.SWARM_STATUS:
      handleSwarmStatus(lastMessage, data, store);
      break;
    case PACKET_TYPES.TOOL_SKIP:
      handleToolSkip(lastMessage, data, store);
      break;
    case PACKET_TYPES.HEARTBEAT:
      handleHeartbeat(lastMessage, data, store);
      break;
    case PACKET_TYPES.STATE_CHANGE:
      handleStateChange(lastMessage, data, store);
      break;
    case PACKET_TYPES.DEGRADED:
      handleDegraded(lastMessage, data, store);
      break;
    case PACKET_TYPES.PROGRESS:
      handleProgress(lastMessage, data, store);
      break;
    case PACKET_TYPES.TURN_COMPLETE:
      handleTurnComplete(lastMessage, data, store);
      break;
    case PACKET_TYPES.ERROR:
      handleError(lastMessage, data, store);
      break;
    case PACKET_TYPES.SYSTEM_NOTICE:
      handleSystemNotice(lastMessage, data, store);
      break;
    case PACKET_TYPES.TOKEN_METRICS:
      handleTokenMetrics(lastMessage, data, store);
      break;
    case PACKET_TYPES.HITL_APPROVAL_REQUIRED:
      handleHitlApproval(lastMessage, data, store);
      break;
    case PACKET_TYPES.MISSION_COMPLETED:
      handleMissionCompleted(lastMessage, data, store);
      break;
    default:
      handleDefault(lastMessage, data, store);
  }

  const nextMsgs = [...currentMsgs];
  nextMsgs[nextMsgs.length - 1] = lastMessage;
  store.setMessages(nextMsgs);
}
