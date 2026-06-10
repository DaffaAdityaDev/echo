export const PLANNING_CONFIG = {
  NAME: 'write_todos',
  DESCRIPTION: 'Create, update, or reorganize the agent\'s task plan (todo list). Use this tool to set or modify the planned execution steps. This will update the persistent STATE.md document.',
  KEYWORDS: ["todo", "tasks", "plan", "strategy", "list", "write_todos"],
  STATUS_ENUM: ['pending', 'in_progress', 'done', 'failed'] as const,
  STATE_FILE_NAME: 'STATE.md',
  FILE_ENCODING: 'utf-8' as const,
} as const;

export const TASK_STATUS = {
  DONE: 'done',
  IN_PROGRESS: 'in_progress',
  FAILED: 'failed',
  PENDING: 'pending',
} as const;

export const SCHEMA_DESC = {
  TODOS: 'The complete list of tasks/todos representing the plan',
  TODO_ID: 'Unique ID for the task',
  TODO_DESC: 'Detailed description of what needs to be done',
  TODO_STATUS: 'Current status of the task',
} as const;

export const OPERATION_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export const STATUS_MARKERS = {
  DONE: '[x]',
  IN_PROGRESS: '[/]',
  FAILED: '[!] failed:',
  PENDING: '[ ]',
} as const;

export const PLANNING_LOGS = {
  UPDATING: 'Updating agent todos',
  FAILED: 'Failed to write plan/todos',
  ERROR_PREFIX: 'Failed to write plan',
} as const;

export const PLANNING_TEMPLATES = {
  HEADER: `# Agent Active State & Plan\n\n`,
  LAST_UPDATED: (dateStr: string) => `Last Updated: ${dateStr}\n\n`,
  TASK_LIST_HEADER: `## Task List\n\n`,
  TASK_LINE: (marker: string, id: string, desc: string, status: string) => 
    `- ${marker} **${id}**: ${desc} *(Status: ${status})*\n`,
  SUMMARY_SUCCESS: (count: number) => `Successfully updated plan with ${count} tasks and saved to STATE.md.`,
} as const;
