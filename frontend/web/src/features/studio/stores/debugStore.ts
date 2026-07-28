"use client";

import { create } from "zustand";
import type { AgentStatus, MissionMeta, StreamPacket, TokenUsage } from "@/features/chat/types";

let packetIdCounter = 0;

export type LoggedPacket = StreamPacket & {
  id: string;
  receivedAt: number;
};

export interface DebugInfo {
  iteration: number;
  systemPrompt: string;
  messages: { role: string; content: string }[];
}

export interface TimelineEvent {
  name: string;
  args: Record<string, unknown>;
  startedAt: number;
  duration?: number;
  result?: string;
  status: "running" | "completed" | "failed" | "skipped";
}

export interface StateChange {
  from: string;
  to: string;
  reason: string;
  timestamp: number;
}

export interface TreeNode {
  id: string;
  name: string;
  instruction: string;
  result?: string;
  status: "calling" | "completed" | "failed";
  children: TreeNode[];
}

export interface DebugState {
  packetLogs: LoggedPacket[];
  agentStatus: AgentStatus | null;
  missionMeta: MissionMeta | null;
  cumulativeUsage: TokenUsage | null;
  debugInfo: DebugInfo[];
  streamingContent: string;
  streamingReasoning: string;
  agentTree: TreeNode[];
  stateChanges: StateChange[];
  toolCalls: TimelineEvent[];
  degradationLevel: "normal" | "restricted" | "standard";
  missionState: "starting" | "running" | "completed" | "aborted" | "error";
  totalCost: number;
  maxIterations: number;

  appendPacketLog: (packet: StreamPacket) => void;
  appendDebugInfo: (info: DebugInfo) => void;
  setCumulativeUsage: (usage: TokenUsage) => void;
  addStreamingContent: (chunk: string) => void;
  addReasoningChunk: (chunk: string) => void;
  addSubagentCall: (name: string, instruction: string) => void;
  addSubagentResult: (name: string, instruction: string, result: string, status: "completed" | "failed") => void;
  addToolCall: (name: string, args: Record<string, unknown>, timestamp: number) => void;
  addToolResult: (name: string, content: string, timestamp: number) => void;
  setDegradation: (from: string, to: string, reason: string) => void;
  setMissionState: (state: "starting" | "running" | "completed" | "aborted" | "error") => void;
  setMissionMeta: (meta: MissionMeta) => void;
  addStateChange: (from: string, to: string, reason: string, timestamp: number) => void;
  setTotalCost: (cost: number) => void;
  setAgentStatus: (status: AgentStatus) => void;
  reset: () => void;
}

const MAX_PACKET_LOGS = 500;
const MAX_DEBUG_INFO = 50;

const initial: Pick<
  DebugState,
  | "packetLogs"
  | "agentStatus"
  | "missionMeta"
  | "cumulativeUsage"
  | "debugInfo"
  | "streamingContent"
  | "streamingReasoning"
  | "agentTree"
  | "stateChanges"
  | "toolCalls"
  | "degradationLevel"
  | "missionState"
  | "totalCost"
  | "maxIterations"
> = {
  packetLogs: [],
  agentStatus: null,
  missionMeta: null,
  cumulativeUsage: null,
  debugInfo: [],
  streamingContent: "",
  streamingReasoning: "",
  agentTree: [],
  stateChanges: [],
  toolCalls: [],
  degradationLevel: "normal",
  missionState: "starting",
  totalCost: 0,
  maxIterations: 15,
};

export const useDebugStore = create<DebugState>((set) => ({
  ...initial,

  appendPacketLog: (packet) =>
    set((state) => {
      const id = `pkt_${++packetIdCounter}`;
      const logged: LoggedPacket = { ...packet, id, receivedAt: Date.now() };
      const next = [...state.packetLogs, logged];
      if (next.length > MAX_PACKET_LOGS) next.splice(0, next.length - MAX_PACKET_LOGS);
      return { packetLogs: next };
    }),

  appendDebugInfo: (info) =>
    set((state) => {
      const next = [...state.debugInfo, info];
      if (next.length > MAX_DEBUG_INFO) next.splice(0, next.length - MAX_DEBUG_INFO);
      return { debugInfo: next };
    }),

  setCumulativeUsage: (usage) => set({ cumulativeUsage: usage }),

  addStreamingContent: (chunk) =>
    set((state) => ({
      streamingContent: state.streamingContent + chunk,
    })),

  addReasoningChunk: (chunk) =>
    set((state) => ({
      streamingReasoning: state.streamingReasoning + chunk,
    })),

  addSubagentCall: (name, instruction) =>
    set((state) => {
      const id = `sub_${name}_${Date.now()}`;
      const node: TreeNode = { id, name, instruction, status: "calling", children: [] };
      return { agentTree: [...state.agentTree, node] };
    }),

  addSubagentResult: (name, instruction, result, status) =>
    set((state) => {
      const tree = state.agentTree.map((n) => {
        if (n.name === name && n.status === "calling") {
          return { ...n, result, status, instruction };
        }
        return n;
      });
      return { agentTree: tree };
    }),

  addToolCall: (name, args, timestamp) =>
    set((state) => {
      const event: TimelineEvent = {
        name,
        args,
        startedAt: timestamp,
        status: "running",
      };
      return { toolCalls: [...state.toolCalls, event] };
    }),

  addToolResult: (name, content, timestamp) =>
    set((state) => {
      const calls = [...state.toolCalls];
      const idx = calls.findLastIndex((t) => t.name === name && t.status === "running");
      if (idx !== -1) {
        calls[idx] = {
          ...calls[idx],
          duration: timestamp - calls[idx].startedAt,
          result: content,
          status: "completed",
        };
      }
      return { toolCalls: calls };
    }),

  setDegradation: (from, to, reason) =>
    set((state) => {
      let level: "normal" | "restricted" | "standard" = "standard";
      if (to === "normal") level = "normal";
      else if (to === "restricted") level = "restricted";
      return { degradationLevel: level };
    }),

  setMissionState: (state) => set({ missionState: state }),

  setMissionMeta: (meta) =>
    set({
      missionMeta: meta,
      maxIterations: meta.maxIterations ?? 15,
    }),

  addStateChange: (from, to, reason, timestamp) =>
    set((state) => ({
      stateChanges: [...state.stateChanges, { from, to, reason, timestamp }],
    })),

  setTotalCost: (cost) => set({ totalCost: cost }),

  setAgentStatus: (status) => set({ agentStatus: status }),

  reset: () => set({ ...initial }),
}));
