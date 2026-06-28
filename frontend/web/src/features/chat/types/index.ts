export interface ThoughtStep {
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'todo' | 'subagent_call' | 'subagent_result' | 'file_operation' | 'swarm_status';
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
  type?: 'content' | 'reasoning' | 'tool_call' | 'tool_result' | 'metadata' | 'usage' | 'todo' | 'subagent_call' | 'subagent_result' | 'file_operation' | 'swarm_status';
  missionId?: string;
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
  choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
  toolResult?: any;
}

export interface FailedUrl {
  url: string;
  reason: string;
}

export interface AgentProgress {
  iteration: number;
  totalIterations: number;
  currentTool?: string;
  swarm?: {
    scrapedCount: number;
    failedCount: number;
    factsCount: number;
    discoveredCount: number;
    status?: string;
    url?: string;
    depth?: number;
    failedUrls: FailedUrl[];
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
