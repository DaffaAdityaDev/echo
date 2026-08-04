import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MCPClient } from "../../../infrastructure/transports/mcp/client";
import type { McpServerConfig } from "../../../infrastructure/transports/mcp/types";
import { RestAdapter } from "../../../infrastructure/transports/rest/adapter";
import type { RestToolConfig } from "../../../infrastructure/transports/rest/types";
import type { ToolDefinition } from "../../../shared/types";
import { logger } from "../../../shared/utils/logger";
import { CredentialManager } from "../credentials/manager";

// 1. Static Lazy-Loading Registry (Developer controlled)
export const LAZY_TOOLS: Record<string, () => Promise<{ default: ToolDefinition } | ToolDefinition>> = {
  delegate_task: () => import("./definitions/delegation"),
  write_todos: () => import("./definitions/planning"),
  web_search: () => import("./definitions/web-search"),
};

export interface ImplementedFeature {
  id: string;
  name: string;
  description: string;
}

export function getImplementedFeatures(registry: ToolRegistry = toolRegistry): ImplementedFeature[] {
  const loadedById = new Map<string, ToolDefinition>();
  for (const tool of registry.getAllTools()) {
    loadedById.set(tool.name, tool);
  }

  const features: ImplementedFeature[] = [];
  for (const id of Object.keys(LAZY_TOOLS)) {
    const tool = loadedById.get(id);
    if (tool) {
      features.push({ id, name: tool.name, description: tool.description });
    } else {
      features.push({ id, name: id, description: "" });
    }
  }
  return features.sort((a, b) => a.id.localeCompare(b.id));
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private mcpClients: Map<string, MCPClient> = new Map();
  private restTools: ToolDefinition[] = [];
  private credentialManager?: CredentialManager;

  constructor(credentialManager?: CredentialManager) {
    this.credentialManager = credentialManager;
  }

  setCredentialManager(cm: CredentialManager): void {
    this.credentialManager = cm;
  }

  private ensureCredentialManager(): CredentialManager {
    if (!this.credentialManager) {
      this.credentialManager = new CredentialManager();
      logger.warn("CredentialManager not set — using default fallback instance");
    }
    return this.credentialManager;
  }

  /**
   * Scans the definitions/ directory and auto-imports all tool modules.
   */
  async autoload() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    let definitionsPath = join(__dirname, "definitions");

    if (!existsSync(definitionsPath)) {
      definitionsPath = join(process.cwd(), "src/core/agent/tools/definitions");
    }

    if (!existsSync(definitionsPath)) {
      logger.info("⏭️ Dynamic definitions directory not found — relying on static LAZY_TOOLS catalog");
      return;
    }

    try {
      const entries = await readdir(definitionsPath, { withFileTypes: true });
      for (const entry of entries) {
        let importPath = "";
        if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
          // Ignore deprecated redirect files that have been relocated
          if (entry.name === "delegation.ts") {
            continue;
          }
          importPath = join(definitionsPath, entry.name);
        } else if (entry.isDirectory()) {
          importPath = join(definitionsPath, entry.name, "index.ts");
        }

        if (importPath) {
          try {
            const module = await import(importPath);
            const tool: ToolDefinition = module.default || module;

            if (tool && tool.name && tool.schema) {
              this.tools.set(tool.name, tool);
              logger.info(`Tool registered: ${tool.name}`);
            }
          } catch (err: any) {
            // Suppress logs for directories without index.ts or other standard non-tool directories
            if (entry.isFile()) {
              logger.warn(`Failed to import tool ${entry.name}: ${err.message}`);
            }
          }
        }
      }
    } catch (error) {
      logger.error("Failed to autoload tools", error);
    }
  }

  /**
   * Resolves and loads specified tools dynamically.
   * Returns empty array if no features specified — harness
   * falls back to ToolRetriever for keyword-based selection.
   */
  async resolveTools(features?: string[]): Promise<ToolDefinition[]> {
    if (!features || features.length === 0) {
      logger.info(`[resolveTools] No features provided (features=${JSON.stringify(features)}) — returning empty`);
      return [];
    }

    logger.info(`[resolveTools] Resolving features: ${JSON.stringify(features)}`);
    const resolved: ToolDefinition[] = [];
    for (const featureId of features) {
      const loadFn = LAZY_TOOLS[featureId];
      if (loadFn) {
        try {
          const module = await loadFn();
          const tool = ("default" in module ? module.default : module) as ToolDefinition;
          if (tool && tool.name && tool.schema) {
            resolved.push(tool);
            logger.info(
              `[resolveTools] Loaded tool: ${tool.name} (has execute: ${typeof tool.execute === "function"})`,
            );
          } else {
            logger.warn(
              `[resolveTools] Tool '${featureId}' loaded but missing name/schema: ${JSON.stringify({ name: tool?.name, hasSchema: !!tool?.schema })}`,
            );
          }
        } catch (err: any) {
          logger.error(`[resolveTools] Failed to lazy load tool '${featureId}': ${err.message}`);
        }
      } else {
        logger.warn(
          `[resolveTools] Tool '${featureId}' not found in LAZY_TOOLS registry. Available: ${Object.keys(LAZY_TOOLS).join(", ")}`,
        );
      }
    }
    logger.info(`[resolveTools] Resolved ${resolved.length} tools: ${resolved.map((t) => t.name).join(", ")}`);
    return resolved;
  }

  async connectMCPServer(config: McpServerConfig): Promise<MCPClient> {
    if (this.mcpClients.has(config.name)) {
      logger.warn(`MCP server "${config.name}" already connected`);
      return this.mcpClients.get(config.name)!;
    }

    if (config.credentials) {
      this.ensureCredentialManager().registerToolCredentials(config.name, config.credentials);
    }

    const client = new MCPClient(config, this.credentialManager);
    await client.connect();
    await client.discoverTools();

    this.mcpClients.set(config.name, client);
    logger.info(`MCP server connected: ${config.name}`);
    return client;
  }

  async disconnectMCPServer(name: string): Promise<void> {
    const client = this.mcpClients.get(name);
    if (!client) {
      logger.warn(`MCP server "${name}" not found`);
      return;
    }

    await client.disconnect();
    this.mcpClients.delete(name);
    logger.info(`MCP server disconnected: ${name}`);
  }

  addRestTool(config: RestToolConfig): void {
    const cm = this.ensureCredentialManager();
    const adapter = new RestAdapter(cm);
    const tool = adapter.createTool(config);
    this.restTools.push(tool);

    if (config.headers) {
      cm.registerToolCredentials(config.name, config.headers);
    }
    if (config.params) {
      cm.registerToolCredentials(config.name, config.params);
    }

    logger.info(`REST tool registered: ${config.name}`);
  }

  getMCPServer(name: string): MCPClient | undefined {
    return this.mcpClients.get(name);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    const all = Array.from(this.tools.values());
    for (const client of this.mcpClients.values()) {
      all.push(...client.getTools());
    }
    all.push(...this.restTools);
    return all;
  }

  resolveToolsMap(names: string[]): Map<string, ToolDefinition> {
    const map = new Map<string, ToolDefinition>();
    for (const name of names) {
      const tool = this.getTool(name);
      if (tool) map.set(name, tool);
    }
    return map;
  }
}

export const toolRegistry = new ToolRegistry();
