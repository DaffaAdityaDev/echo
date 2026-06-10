export const WORKSPACE_TYPES = {
  ARTIFACT: 'artifact',
  RUNTIME: 'runtime',
} as const;

export const LIST_FILES_CONFIG = {
  NAME: 'list_files',
  DESCRIPTION: 'List files in the workspace artifacts or runtime directories.',
  KEYWORDS: ["files", "list", "directory", "folders", "workspace", "artifacts"],
  TYPES: [WORKSPACE_TYPES.ARTIFACT, WORKSPACE_TYPES.RUNTIME] as const,
  DEFAULT_TYPE: WORKSPACE_TYPES.ARTIFACT,
} as const;

export const SCHEMA_DESC = {
  TYPE: 'The directory type to list files from',
} as const;

export const OPERATION_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export const LIST_FILES_LOGS = {
  ERROR: 'Failed to list files',
} as const;

export const LIST_FILES_FORMATS = {
  SUMMARY_HEADER: (type: string) => `Files in ${type} directory:\n`,
  SUMMARY_LINE: (file: string) => `- ${file}`,
} as const;
