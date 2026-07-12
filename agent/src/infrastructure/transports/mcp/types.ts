export interface McpServerConfig {
  name: string
  url: string
  transport: 'sse' | 'stdio'
  command?: string
  args?: string[]
  credentials?: Record<string, string>
  timeout?: number
}

export interface McpToolDefinition {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}
