export interface ThoughtStep {
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'todo' | 'subagent_call' | 'subagent_result' | 'file_operation';
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
}

export interface MissionMeta {
  missionId?: string;
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
  type?: 'content' | 'reasoning' | 'tool_call' | 'tool_result' | 'metadata' | 'usage' | 'todo' | 'subagent_call' | 'subagent_result' | 'file_operation';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  meta?: MissionMeta | TokenUsage;
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
  choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
}
