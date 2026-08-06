import { useChatStore } from "../stores/chatStore";

export function useChatMessages() {
  return useChatStore((s) => s.messages);
}

export function useChatIsLoading() {
  return useChatStore((s) => s.isLoading);
}

export function useAgentState() {
  return useChatStore((s) => s.agentState);
}

export function useSystemNotices() {
  return useChatStore((s) => s.systemNotices);
}

export function useHitlApprovalPending() {
  return useChatStore((s) => s.hitlPendingApproval);
}

export function useSelectedModel() {
  return useChatStore((s) => s.selectedModel);
}

export function useSetSelectedModel() {
  return useChatStore((s) => s.setSelectedModel);
}

export function useSelectedFeatures() {
  return useChatStore((s) => s.selectedFeatures);
}

export function useSetSelectedFeatures() {
  return useChatStore((s) => s.setSelectedFeatures);
}

export function useMissionMeta() {
  return useChatStore((s) => s.missionMeta);
}

export function usePacketLogs() {
  return useChatStore((s) => s.packetLogs);
}

export function useDebugPacketHistory() {
  return useChatStore((s) => s.debugPacketHistory);
}

export function useCumulativeUsage() {
  return useChatStore((s) => s.cumulativeUsage);
}

export function useMaxPacketLogSize() {
  return useChatStore((s) => s.maxPacketLogSize);
}

export function useSetMaxPacketLogSize() {
  return useChatStore((s) => s.setMaxPacketLogSize);
}

export function useActiveSessionId() {
  return useChatStore((s) => s.activeSessionId);
}

export function useSetActiveSession() {
  return useChatStore((s) => s.setActiveSession);
}

export function useChatSessions() {
  return useChatStore((s) => s.sessions);
}

export function useChatMode() {
  return useChatStore((s) => s.mode);
}

export function useSetChatMode() {
  return useChatStore((s) => s.setMode);
}

export function useAgentProgress() {
  return useChatStore((s) => s.agentProgress);
}

export function useDismissSystemNotice() {
  return useChatStore((s) => s.dismissSystemNotice);
}

export function useClearHitlApproval() {
  return useChatStore((s) => s.clearHitlPendingApproval);
}

export function useClearPacketLogs() {
  return useChatStore((s) => s.clearPacketLogs);
}
