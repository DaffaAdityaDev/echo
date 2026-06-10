export const WORKSPACE_TYPES = {
  ARTIFACT: 'artifact',
  RUNTIME: 'runtime',
} as const;

export const READ_FILE_CONFIG = {
  NAME: 'read_file',
  DESCRIPTION: 'Read a file\'s contents from the workspace. Supports type "artifact" or "runtime".',
  KEYWORDS: ["read", "view", "file", "text", "contents", "open"],
  TYPES: [WORKSPACE_TYPES.ARTIFACT, WORKSPACE_TYPES.RUNTIME] as const,
  DEFAULT_TYPE: WORKSPACE_TYPES.ARTIFACT,
  FILE_ENCODING: 'utf-8' as const,
  TRUNCATION_LIMIT: 1000,
} as const;

export const SCHEMA_DESC = {
  FILENAME: 'Name of the file to read',
  TYPE: 'The directory type to read from',
} as const;

export const OPERATION_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export const READ_FILE_ERRORS = {
  CODE_NOT_FOUND: 'ENOENT',
  LOG_FAILED: (filename: string) => `Failed to read file ${filename}`,
  SUMMARY_GENERIC_ERROR: (msg: string) => `Failed to read file: ${msg}`,
  SUMMARY_NOT_FOUND: (filename: string, type: string) => 
    `Error: File '${filename}' was not found in the '${type}' workspace directory. You must create it first using the 'write_file' tool before attempting to read it.`,
} as const;

export const READ_FILE_FORMATS = {
  SUMMARY_SUCCESS: (filename: string, snippet: string, isTruncated: boolean) => 
    `Successfully read "${filename}":\n\n${snippet}${isTruncated ? '\n...[truncated]' : ''}`,
} as const;
