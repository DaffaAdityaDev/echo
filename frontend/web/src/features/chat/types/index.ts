export interface ThoughtStep {
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'tool_skip' | 'state_change' | 'todo' | 'subagent_call' | 'subagent_result' | 'file_operation' | 'swarm_status';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  todos?: Array<{ id: string; description: string; status: 'pending' | 'in_progress' | 'done' | 'failed' }>;
  subagent?: {
    name: string;
    instruction: string;
    result?: string;
    status: 'calling' | 'completed' | 'failed';
  };
  fileOp?: {
    operation: 'write' | 'read' | 'offload';
    path: string;
    preview?: string;
  };
  swarm?: {
    status: 'crawling' | 'scraped' | 'critic_validating' | 'critic_passed' | 'critic_failed' | 'synthesis' | 'scrape_failed';
    depth: number;
    url?: string;
    activeAgents?: number;
    estTime?: string;
    dataSize?: number;
    discoveredLinks?: number;
    factsCount?: number;
    feedback?: string;
    message?: string;
  };
}

export interface MissionMeta {
  missionId?: string;
  strategy?: string;
  historyDepth?: number;
  toolsAvailable?: string[];
  objective?: string;
  maxIterations?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
}

export type ChatMode = 'standard' | 'agent'

export interface Message {
  role: "user" | "assistant";
  content: string;
  steps: ThoughtStep[];
  meta?: MissionMeta;
  usage?: TokenUsage;
  id: string;
  status?: 'streaming' | 'complete' | 'interrupted';
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DbMessage {
  id: number;
  session_id: string;
  role: string;
  content: string;
  token_count: number;
  turn_number: number;
  steps?: ThoughtStep[] | null;
  status?: 'streaming' | 'complete' | 'interrupted';
  created_at: string;
}

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  contextSummary?: string;
}

export type AgentState = 'starting' | 'running' | 'looping' | 'stalled' | 'degraded' | 'completed' | 'aborted' | 'error';

export interface AgentStatus {
  state: AgentState;
  step: number;
  throughput: number;
  activeBreakers: string[];
  currentTool?: string;
  thought?: string;
  lastActivity: number;
}

export interface TurnComplete {
  tokenCount: number;
  toolCalls: number;
  duration: number;
}

interface StreamPacketBase {
  missionId: string;
  step: number;
  seq: number;
  timestamp: number;
  agentStatus?: AgentStatus;
}

export type StreamPacket =
  | (StreamPacketBase & { type: 'metadata'; meta?: MissionMeta; content?: string; strategy?: string; historyDepth?: number; toolsAvailable?: string[]; objective?: string; maxIterations?: number; title?: string; summary?: string; })
  | (StreamPacketBase & { type: 'reasoning'; content: string; })
  | (StreamPacketBase & { type: 'content'; content: string; })
  | (StreamPacketBase & { type: 'tool_call'; toolName: string; toolInput: Record<string, unknown>; })
  | (StreamPacketBase & { type: 'tool_result'; toolName: string; content: string; toolResult?: unknown; })
  | (StreamPacketBase & { type: 'tool_skip'; toolName: string; })
  | (StreamPacketBase & { type: 'todo'; todos: Array<{ id: string; description: string; status: 'pending' | 'in_progress' | 'done' | 'failed' }>; })
  | (StreamPacketBase & { type: 'subagent_call' | 'subagent_result'; subagent: { name: string; instruction: string; result?: string; status: 'calling' | 'completed' | 'failed'; }; })
  | (StreamPacketBase & { type: 'usage'; usage: { promptTokens: number; completionTokens: number; totalTokens: number; cachedTokens?: number; reasoningTokens?: number; }; })
  | (StreamPacketBase & { type: 'progress'; phase: string; tokensUsed: number; tokensTotal: number; })
  | (StreamPacketBase & { type: 'heartbeat'; })
  | (StreamPacketBase & { type: 'state_change'; from: string; to: string; reason: string; })
  | (StreamPacketBase & { type: 'degraded'; from: string; to: string; reason: string; })
  | (StreamPacketBase & { type: 'turn_complete'; completed?: boolean; totalIterations?: number; totalCost?: number; usage?: TokenUsage; })
  | (StreamPacketBase & { type: 'debug'; rawSystemPrompt: string; currentHistoryLength: number; rawMessages: Array<{ role: string; content: string }>; })
  | (StreamPacketBase & { type: 'error'; content: string; code?: string; })
  | (StreamPacketBase & { type: 'swarm_status'; swarm: { status: 'crawling' | 'scraped' | 'critic_validating' | 'critic_passed' | 'critic_failed' | 'synthesis' | 'scrape_failed'; url?: string; depth: number; attempt?: number; dataSize?: number; factsCount?: number; feedback?: string; message?: string; }; })
  | (StreamPacketBase & { type: 'file_operation'; fileOp: { operation: 'write' | 'read' | 'offload'; path: string; preview?: string; }; });

export interface FailedUrl {
  url: string;
  reason: string;
}

export interface AgentProgressData {
  state?: AgentState;
  agentStatus?: AgentStatus;
  iteration: number;
  totalIterations: number;
  currentTool?: string;
  statusMessage?: string;
  swarm?: {
    scrapedCount: number;
    failedCount: number;
    factsCount: number;
    discoveredCount: number;
    discoveredUrls?: string[];
    status?: string;
    url?: string;
    depth?: number;
    failedUrls?: FailedUrl[];
    activeUrls: Record<string, {
      url: string;
      status: string;
      factsCount?: number;
      dataSize?: number;
      attempt?: number;
      feedback?: string;
    }>;
  };
}

export type AgentProgress = AgentProgressData;
