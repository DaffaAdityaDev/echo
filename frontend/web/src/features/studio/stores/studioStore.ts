"use client";

import { create } from "zustand";
import type { AgentStatus, MissionMeta, StreamPacket, TokenUsage } from "@/features/chat/types";

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

interface StudioState {
  debugMode: boolean;
  debugPackets: LoggedPacket[];
  debugAgentStatus: AgentStatus | null;
  debugMissionMeta: MissionMeta | null;
  debugCumulativeUsage: TokenUsage | null;
  debugInfo: DebugInfo[];
  debugAgentTree: TreeNode[];
  debugStateChanges: StateChange[];
  debugToolCalls: TimelineEvent[];
  debugDegradationLevel: string;
  debugMissionState: string;
  debugTotalCost: number;
  debugMaxIterations: number;
  debugContent: string;
  debugReasoning: string;
  debugError: string | null;
  debugIsRunning: boolean;

  setDebugMode: (mode: boolean) => void;
  appendDebugPacket: (packet: StreamPacket) => void;
  appendDebugInfo: (info: DebugInfo) => void;
  setDebugUsage: (usage: TokenUsage) => void;
  addDebugContent: (chunk: string) => void;
  addDebugReasoning: (chunk: string) => void;
  addDebugSubagentCall: (name: string, instruction: string) => void;
  addDebugSubagentResult: (name: string, instruction: string, result: string, status: string) => void;
  addDebugToolCall: (name: string, args: Record<string, unknown>, timestamp: number) => void;
  addDebugToolResult: (name: string, content: string, timestamp: number) => void;
  addDebugStateChange: (from: string, to: string, reason: string, timestamp: number) => void;
  setDebugDegradation: (from: string, to: string, reason: string) => void;
  setDebugMissionState: (state: string) => void;
  setDebugMeta: (meta: MissionMeta) => void;
  setDebugRunning: (running: boolean) => void;
  setDebugError: (error: string | null) => void;
  setDebugTotalCost: (cost: number) => void;
  resetDebug: () => void;
}

let debugPacketIdCounter = 0;

const debugInitial = {
  debugMode: false,
  debugPackets: [],
  debugAgentStatus: null,
  debugMissionMeta: null,
  debugCumulativeUsage: null,
  debugInfo: [],
  debugAgentTree: [],
  debugStateChanges: [],
  debugToolCalls: [],
  debugDegradationLevel: "normal",
  debugMissionState: "starting",
  debugTotalCost: 0,
  debugMaxIterations: 15,
  debugContent: "",
  debugReasoning: "",
  debugError: null,
  debugIsRunning: false,
};

export const useStudioStore = create<StudioState>((set) => ({
  ...debugInitial,

  setDebugMode: (mode) => set({ debugMode: mode }),

  appendDebugPacket: (packet) =>
    set((state) => {
      const id = `pkt_${++debugPacketIdCounter}`;
      const logged: LoggedPacket = { ...packet, id, receivedAt: Date.now() };
      const next = [...state.debugPackets, logged];
      if (next.length > 500) next.splice(0, next.length - 500);
      return { debugPackets: next };
    }),

  appendDebugInfo: (info) =>
    set((state) => {
      const next = [...state.debugInfo, info];
      if (next.length > 50) next.splice(0, next.length - 50);
      return { debugInfo: next };
    }),

  setDebugUsage: (usage) => set({ debugCumulativeUsage: usage }),

  addDebugContent: (chunk) =>
    set((state) => ({
      debugContent: state.debugContent + chunk,
    })),

  addDebugReasoning: (chunk) =>
    set((state) => ({
      debugReasoning: state.debugReasoning + chunk,
    })),

  addDebugSubagentCall: (name, instruction) =>
    set((state) => {
      const id = `sub_${name}_${Date.now()}`;
      const node: TreeNode = { id, name, instruction, status: "calling", children: [] };
      return { debugAgentTree: [...state.debugAgentTree, node] };
    }),

  addDebugSubagentResult: (name, instruction, result, status) =>
    set((state) => {
      const tree = state.debugAgentTree.map((n) => {
        if (n.name === name && n.status === "calling") {
          return { ...n, result, status: status as TreeNode["status"], instruction };
        }
        return n;
      });
      return { debugAgentTree: tree };
    }),

  addDebugToolCall: (name, args, timestamp) =>
    set((state) => {
      const event: TimelineEvent = { name, args, startedAt: timestamp, status: "running" };
      return { debugToolCalls: [...state.debugToolCalls, event] };
    }),

  addDebugToolResult: (name, content, timestamp) =>
    set((state) => {
      const calls = [...state.debugToolCalls];
      const idx = calls.findLastIndex((t) => t.name === name && t.status === "running");
      if (idx !== -1) {
        calls[idx] = {
          ...calls[idx],
          duration: timestamp - calls[idx].startedAt,
          result: content,
          status: "completed",
        };
      }
      return { debugToolCalls: calls };
    }),

  addDebugStateChange: (from, to, reason, timestamp) =>
    set((state) => ({
      debugStateChanges: [...state.debugStateChanges, { from, to, reason, timestamp }],
    })),

  setDebugDegradation: (_from, to, _reason) =>
    set({
      debugDegradationLevel: to,
    }),

  setDebugMissionState: (state) => set({ debugMissionState: state }),

  setDebugMeta: (meta) =>
    set({
      debugMissionMeta: meta,
      debugMaxIterations: meta.maxIterations ?? 15,
    }),

  setDebugRunning: (running) => set({ debugIsRunning: running }),

  setDebugError: (error) => set({ debugError: error }),

  setDebugTotalCost: (cost) => set({ debugTotalCost: cost }),

  resetDebug: () => set({ ...debugInitial }),
}));
