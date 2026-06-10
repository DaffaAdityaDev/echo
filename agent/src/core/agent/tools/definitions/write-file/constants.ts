export const WORKSPACE_TYPES = {
  ARTIFACT: 'artifact',
  RUNTIME: 'runtime',
} as const;

export const WRITE_FILE_CONFIG = {
  NAME: 'write_file',
  DESCRIPTION: 'Write text content to a file in the workspace. Use path type "artifact" for user-facing outputs and deliverables, or "runtime" for internal logs/data.',
  KEYWORDS: ["write", "save", "create", "file", "text", "output", "export"],
  TYPES: [WORKSPACE_TYPES.ARTIFACT, WORKSPACE_TYPES.RUNTIME] as const,
  DEFAULT_TYPE: WORKSPACE_TYPES.ARTIFACT,
  FILE_ENCODING: 'utf-8' as const,
} as const;

export const SCHEMA_DESC = {
  FILENAME: 'Name of the file (e.g. report.md)',
  CONTENT: 'The content to write to the file',
  TYPE: 'Whether this is a final user-facing deliverable or internal runtime state',
} as const;

export const OPERATION_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export const WRITE_FILE_LOGS = {
  ERROR: (filename: string) => `Failed to write file ${filename}`,
} as const;

export const WRITE_FILE_SUMMARIES = {
  SUCCESS: (filename: string, type: string) => `Successfully wrote file "${filename}" to ${type} directory.`,
  GENERIC_ERROR: (msg: string) => `Failed to write file: ${msg}`,
} as const;
