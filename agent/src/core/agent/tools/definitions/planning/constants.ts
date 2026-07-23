export const PLANNING_CONFIG = {
  NAME: 'write_todos',
  DESCRIPTION: 'Create, update, or reorganize the agent\'s task plan (todo list). Use this tool to set or modify the planned execution steps.',
  KEYWORDS: ["todo", "tasks", "plan", "strategy", "list", "write_todos"],
  STATUS_ENUM: ['pending', 'in_progress', 'done', 'failed'] as const,
} as const;

export const SCHEMA_DESC = {
  TODOS: 'The complete list of tasks/todos representing the plan',
  TODO_ID: 'Unique ID for the task',
  TODO_DESC: 'Detailed description of what needs to be done',
  TODO_STATUS: 'Current status of the task',
} as const;

export const PLANNING_LOGS = {
  UPDATING: 'Updating agent todos',
  FAILED: 'Failed to write plan/todos',
  ERROR_PREFIX: 'Failed to write plan',
} as const;

export const PLANNING_TEMPLATES = {
  SUMMARY_SUCCESS: (count: number) => `Successfully updated plan with ${count} tasks.`,
} as const;
