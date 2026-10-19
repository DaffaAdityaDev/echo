import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CredentialManager } from "../../../core/agent/credentials";
import { ERROR_STATUS } from "../../../shared/constants/errors";
import type { JsonObject, JsonValue, Observation, ToolDefinition } from "../../../shared/types";
import { jsonSchemaToZod } from "./schema-converter";
import type { McpServerConfig } from "./types";

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (i < attempts - 1) {
        await Bun.sleep(1000 * 2 ** i);
      }
    }
  }

  throw lastError;
}

function isJsonObject(val: JsonValue | undefined | null): val is JsonObject {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function isString(val: unknown): val is string {
  return typeof val === "string";
}

interface ContentWithText {
  text: string;
}

function hasTextProperty(val: unknown): val is ContentWithText {
  // SAFETY: Checked invariant for MCP content object having a string text property
  return typeof val === "object" && val !== null && "text" in val && typeof (val as ContentWithText).text === "string";
}

export class MCPClient {
  private client: Client;
  private transport: SSEClientTransport | StdioClientTransport | null = null;
  private serverConfig: McpServerConfig;
  private tools: ToolDefinition[] = [];
  private connected = false;
  private credentialManager?: CredentialManager;

  constructor(config: McpServerConfig, credentialManager?: CredentialManager) {
    this.serverConfig = config;
    this.credentialManager = credentialManager;
    this.client = new Client({ name: "echo-agent", version: "1.0.0" });
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    if (this.serverConfig.transport === "sse") {
      this.transport = new SSEClientTransport(new URL(this.serverConfig.url));
    } else {
      this.transport = new StdioClientTransport({
        command: this.serverConfig.command ?? this.serverConfig.url,
        args: this.serverConfig.args,
      });
    }

    const activeTransport = this.transport;

    if (!activeTransport) {
      throw new Error(`Failed to initialize transport for MCP server ${this.serverConfig.name}`);
    }

    await withRetry(() => this.client.connect(activeTransport));
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
    this.tools = [];
  }

  async discoverTools(): Promise<ToolDefinition[]> {
    let result: Awaited<ReturnType<Client["listTools"]>>;

    try {
      result = await this.client.listTools();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Failed to discover MCP tools from ${this.serverConfig.name}: ${msg}`);
    }

    const mcpTools = result.tools || [];

    this.tools = mcpTools.map((mcpTool) => {
      const toolName = mcpTool.name;
      // SAFETY: MCP inputSchema conforms to standard JSON Schema object structure
      const rawSchema = (mcpTool.inputSchema ?? { type: "object" }) as JsonObject;
      const converted = jsonSchemaToZod(rawSchema);

      return {
        name: toolName,
        description: mcpTool.description ?? "",
        schema: converted,
        execute: async (input: JsonValue): Promise<Observation> => {
          try {
            const resolvedInput: JsonObject = isJsonObject(input) ? { ...input } : {};

            if (this.credentialManager && this.serverConfig.credentials) {
              this.credentialManager.registerToolCredentials(toolName, this.serverConfig.credentials);
              const mappings = this.credentialManager.getMappings(toolName);

              for (const m of mappings) {
                resolvedInput[m.key] = process.env[m.envRef] ?? "";
              }
            }

            const callResult = await this.client.callTool({
              name: toolName,
              arguments: resolvedInput,
            });

            let text = "ok";

            if (Array.isArray(callResult.content) && callResult.content.length > 0) {
              const firstContent = callResult.content[0];

              if (hasTextProperty(firstContent)) {
                text = firstContent.text;
              } else if (isString(firstContent)) {
                text = firstContent;
              }
            }

            return { status: "success", summary: text };
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Unknown error";

            return {
              status: ERROR_STATUS,
              summary: errMsg,
              error: errMsg,
            };
          }
        },
      };
    });

    return this.tools;
  }

  getTools(): ToolDefinition[] {
    return this.tools;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
