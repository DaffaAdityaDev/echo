export const DELEGATION_CONFIG = {
  NAME: 'delegate_task',
  DESCRIPTION: 'Delegate a specific sub-task or research query to a specialized child/sub-agent. This isolates the parent workspace and keeps the context window clean.',
  KEYWORDS: ['delegate', 'sub-agent', 'subagent', 'spawn', 'child', 'parallel', 'agent', 'assign', 'background', 'fork', 'split'],
} as const;

export const SCHEMA_DESC = {
  AGENT_NAME: 'Name of the sub-agent (e.g. researcher-agent)',
  INSTRUCTION: 'The task or query for the sub-agent to solve',
  SYSTEM_PROMPT: 'The persona, role, or guidelines for the sub-agent',
  FORK_CONTEXT: 'If true, inherits parent message history. If false, starts with a clean memory/context.',
} as const;

export const OPERATION_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export const PACKET_TYPES = {
  REASONING: 'reasoning',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  CONTENT: 'content',
} as const;

export const DELEGATION_DEFAULTS = {
  STRATEGY_NAME: 'subagent',
  TENANT_ID: 'subagent',
  LOG_INFO_START: (agentName: string) => `Delegating task to sub-agent [${agentName}]`,
  LOG_ERROR_FAIL: (agentName: string) => `Sub-agent delegation to [${agentName}] failed`,
  LOG_REASONING_PREFIX: '[Reasoning] ',
  LOG_ACTION_PREFIX: (toolName: string, toolInput: any) => `[Action] Called tool ${toolName} with input ${JSON.stringify(toolInput)}`,
  LOG_OBSERVATION_PREFIX: (content: string) => `[Observation] Tool returned: ${content}`,
  SUMMARY_SUCCESS: (agentName: string, output: string) => `Sub-agent [${agentName}] completed task.\n\nResult:\n${output}`,
  SUMMARY_FAILURE: (agentName: string, errorMsg: string) => `Sub-agent [${agentName}] failed to execute task: ${errorMsg}`,
} as const;
