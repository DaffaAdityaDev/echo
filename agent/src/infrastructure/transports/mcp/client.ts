import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { z } from 'zod'
import type { CredentialManager } from '../../../core/agent/credentials/manager'
import type { ToolDefinition, Observation } from '../../../shared/types'
import type { McpServerConfig } from './types'
import { jsonSchemaToZod } from './schema-converter'

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        await Bun.sleep(1000 * Math.pow(2, i))
      }
    }
  }
  throw lastError
}

export class MCPClient {
  private client: Client
  private transport: SSEClientTransport | StdioClientTransport | null = null
  private serverConfig: McpServerConfig
  private tools: ToolDefinition[] = []
  private connected = false
  private credentialManager?: CredentialManager

  constructor(config: McpServerConfig, credentialManager?: CredentialManager) {
    this.serverConfig = config
    this.credentialManager = credentialManager
    this.client = new Client({ name: 'echo-agent', version: '1.0.0' })
  }

  async connect(): Promise<void> {
    if (this.connected) return

    if (this.serverConfig.transport === 'sse') {
      this.transport = new SSEClientTransport(new URL(this.serverConfig.url))
    } else {
      this.transport = new StdioClientTransport({
        command: this.serverConfig.command ?? this.serverConfig.url,
        args: this.serverConfig.args,
      })
    }

    await withRetry(() => this.client.connect(this.transport!))
    this.connected = true
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return
    await this.client.close()
    this.connected = false
    this.tools = []
  }

  async discoverTools(): Promise<ToolDefinition[]> {
    let result
    try {
      result = await this.client.listTools()
    } catch (err: any) {
      throw new Error(`Failed to discover MCP tools from ${this.serverConfig.name}: ${err.message}`)
    }
    const mcpTools = result.tools || []

    this.tools = mcpTools.map((mcpTool) => {
      const toolName = mcpTool.name
      const rawSchema = (mcpTool.inputSchema ?? { type: 'object' }) as Record<string, unknown>
      const converted = jsonSchemaToZod(rawSchema)

      return {
        name: toolName,
        description: mcpTool.description ?? '',
        schema: converted as unknown as z.ZodObject<any>,
        execute: async (input: any): Promise<Observation> => {
          try {
            let resolvedInput = { ...(input ?? {}) }
            if (this.credentialManager && this.serverConfig.credentials) {
              this.credentialManager.registerToolCredentials(toolName, this.serverConfig.credentials)
              const mappings = this.credentialManager.getMappings(toolName)
              for (const m of mappings) {
                resolvedInput[m.key] = process.env[m.envRef] ?? ''
              }
            }

            const callResult = await withRetry(() => this.client.callTool({
              name: toolName,
              arguments: resolvedInput,
            }))
            const text =
              (callResult as any).content?.[0]?.text ??
              (callResult as any).content?.[0] ??
              'ok'
            return { status: 'success', summary: String(text) }
          } catch (err: any) {
            return { status: 'error', summary: err.message, error: err.message }
          }
        },
      }
    })

    return this.tools
  }

  getTools(): ToolDefinition[] {
    return this.tools
  }

  isConnected(): boolean {
    return this.connected
  }
}
