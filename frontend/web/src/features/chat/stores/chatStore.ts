import { create } from "zustand";
import type {
  AgentProgress,
  AgentState,
  HitlApproval,
  Message,
  MissionMeta,
  Session,
  StreamPacket,
  SystemNotice,
  TokenUsage,
} from "../types";

export type LoggedPacket = StreamPacket & { timestamp: number };

export interface DebugInfo {
  systemPrompt?: string;
  historyLength?: number;
  rawMessages?: Array<{ role: string; content: string }>;
  missionId?: string;
  timestamp: number;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  agentProgress: AgentProgress | null;
  sessions: Session[];
  activeSessionId: string | null;
  newChatPending: boolean;
  agentState: AgentState;

  // Debug & Telemetry State
  packetLogs: LoggedPacket[];
  maxPacketLogSize: number;
  cumulativeUsage: TokenUsage | null;
  debugPacketHistory: DebugInfo[];
  missionMeta: MissionMeta | null;
  hitlPendingApproval: HitlApproval | null;
  systemNotices: SystemNotice[];

  setMessages: (updater: Message[] | ((prev: Message[]) => Message[])) => void;
  setIsLoading: (loading: boolean) => void;
  setAgentProgress: (updater: AgentProgress | null | ((prev: AgentProgress | null) => AgentProgress | null)) => void;
  setSessions: (sessions: Session[]) => void;
  setActiveSession: (id: string | null) => void;
  setNewChatPending: (pending: boolean) => void;
  setAgentState: (state: AgentState) => void;
  clearMessages: () => void;

  // Debug Actions
  appendPacketLog: (packet: StreamPacket) => void;
  clearPacketLogs: () => void;
  setMaxPacketLogSize: (size: number) => void;
  setCumulativeUsage: (usage: TokenUsage) => void;
  appendDebugInfo: (info: DebugInfo) => void;
  setMissionMeta: (meta: MissionMeta | null) => void;
  setHitlPendingApproval: (approval: HitlApproval | null) => void;
  clearHitlPendingApproval: () => void;
  appendSystemNotice: (notice: SystemNotice) => void;
  dismissSystemNotice: (id: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  agentProgress: null,
  sessions: [],
  activeSessionId: null,
  newChatPending: false,
  agentState: "completed",

  // Debug Telemetry Initial State
  packetLogs: [],
  maxPacketLogSize: 500,
  cumulativeUsage: null,
  debugPacketHistory: [],
  missionMeta: null,
  hitlPendingApproval: null,
  systemNotices: [],

  setMessages: (updater) =>
    set((state) => ({
      messages: typeof updater === "function" ? updater(state.messages) : updater,
    })),
  setIsLoading: (isLoading) => set({ isLoading }),
  setAgentProgress: (updater) =>
    set((state) => ({
      agentProgress: typeof updater === "function" ? updater(state.agentProgress) : updater,
    })),
  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  setNewChatPending: (pending) => set({ newChatPending: pending }),
  setAgentState: (agentState) => set({ agentState }),
  clearMessages: () =>
    set({
      messages: [],
      isLoading: false,
      agentProgress: null,
      packetLogs: [],
      cumulativeUsage: null,
      debugPacketHistory: [],
      missionMeta: null,
      hitlPendingApproval: null,
      systemNotices: [],
    }),

  // Ring Buffer & Debug Actions
  appendPacketLog: (packet) =>
    set((state) => {
      const logged: LoggedPacket = { ...packet, timestamp: Date.now() };
      const nextLogs = [...state.packetLogs, logged];
      if (nextLogs.length > state.maxPacketLogSize) {
        nextLogs.splice(0, nextLogs.length - state.maxPacketLogSize);
      }
      return { packetLogs: nextLogs };
    }),
  clearPacketLogs: () => set({ packetLogs: [] }),
  setMaxPacketLogSize: (maxPacketLogSize) => set({ maxPacketLogSize }),
  setCumulativeUsage: (usage) =>
    set((state) => {
      if (!state.cumulativeUsage) return { cumulativeUsage: usage };
      return {
        cumulativeUsage: {
          promptTokens: (state.cumulativeUsage.promptTokens || 0) + (usage.promptTokens || 0),
          completionTokens: (state.cumulativeUsage.completionTokens || 0) + (usage.completionTokens || 0),
          totalTokens: (state.cumulativeUsage.totalTokens || 0) + (usage.totalTokens || 0),
          reasoningTokens: (state.cumulativeUsage.reasoningTokens || 0) + (usage.reasoningTokens || 0),
          cachedTokens: (state.cumulativeUsage.cachedTokens || 0) + (usage.cachedTokens || 0),
          estimatedCostUsd: (state.cumulativeUsage.estimatedCostUsd || 0) + (usage.estimatedCostUsd || 0),
          maxContextTokens: usage.maxContextTokens ?? state.cumulativeUsage.maxContextTokens,
        },
      };
    }),
  appendDebugInfo: (info) =>
    set((state) => {
      const next = [...state.debugPacketHistory, info];
      if (next.length > 50) next.splice(0, next.length - 50);
      return { debugPacketHistory: next };
    }),
  setMissionMeta: (missionMeta) => set({ missionMeta }),
  setHitlPendingApproval: (hitlPendingApproval) => set({ hitlPendingApproval }),
  clearHitlPendingApproval: () => set({ hitlPendingApproval: null }),
  appendSystemNotice: (notice) =>
    set((state) => {
      const next = [...state.systemNotices, notice];
      if (next.length > 20) next.splice(0, next.length - 20);
      return { systemNotices: next };
    }),
  dismissSystemNotice: (id) =>
    set((state) => ({
      systemNotices: state.systemNotices.filter((n) => n.id !== id),
    })),
}));
