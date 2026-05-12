export interface ThoughtStep {
  type: 'reasoning' | 'tool_call' | 'tool_result';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

export interface MissionMeta {
  strategy?: string;
  historyDepth?: number;
  toolsAvailable?: string[];
  objective?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  steps: ThoughtStep[];
  meta?: MissionMeta;
  usage?: TokenUsage;
  id: string;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamPacket {
  type?: 'content' | 'reasoning' | 'tool_call' | 'tool_result' | 'metadata' | 'usage';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  meta?: MissionMeta | TokenUsage;
  choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
}
