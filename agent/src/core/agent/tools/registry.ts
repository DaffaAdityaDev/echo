import { ToolDefinition } from '../../../shared/types';
import { logger } from '../../../shared/utils/logger';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCPClient } from '../../../infrastructure/transports/mcp/client';
import type { McpServerConfig } from '../../../infrastructure/transports/mcp/types';
import { RestAdapter } from '../../../infrastructure/transports/rest/adapter';
import type { RestToolConfig } from '../../../infrastructure/transports/rest/types';
import { CredentialManager } from '../credentials/manager';

// 1. Static Lazy-Loading Registry (Developer controlled)
export const LAZY_TOOLS: Record<string, () => Promise<{ default: ToolDefinition } | ToolDefinition>> = {
    delegate_task: () => import('./definitions/delegation'),
    write_todos: () => import('./definitions/planning'),
    web_search: () => import('./definitions/web-search'),
};

// 2. Active Feature catalog exposed to API and clients
export const ACTIVE_FEATURES = [
    { id: 'delegate_task', name: 'Sub-Agent Delegation', description: 'Enables splitting complex objectives into sub-tasks and delegating to specialist sub-agents.', tier_requirement: 'pro', ui_schema: { render_type: 'hierarchy_tree', icon: 'users', primary_color: '#3b82f6' } },
    { id: 'web_search', name: 'Web Search', description: 'Quick search for real-time weather, prices, and news facts.', tier_requirement: 'free', ui_schema: { render_type: 'card_list', icon: 'search', primary_color: '#6366f1' } },
    { id: 'write_todos', name: 'Task Planning & Execution Board', description: 'Updates task board list state.', tier_requirement: 'free', ui_schema: { render_type: 'kanban_board', icon: 'check-square', primary_color: '#8b5cf6' } },
];

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
            logger.warn('CredentialManager not set — using default fallback instance');
        }
        return this.credentialManager;
    }

    /**
     * Scans the definitions/ directory and auto-imports all tool modules.
     */
    async autoload() {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const definitionsPath = join(__dirname, 'definitions');
        try {
            const entries = await readdir(definitionsPath, { withFileTypes: true });
            for (const entry of entries) {
                let importPath = "";
                if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
                    // Ignore deprecated redirect files that have been relocated
                    if (entry.name === 'delegation.ts') {
                        continue;
                    }
                    importPath = join(definitionsPath, entry.name);
                } else if (entry.isDirectory()) {
                    importPath = join(definitionsPath, entry.name, 'index.ts');
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
            return [];
        }

        const resolved: ToolDefinition[] = [];
        for (const featureId of features) {
            const loadFn = LAZY_TOOLS[featureId];
            if (loadFn) {
                try {
                    const module = await loadFn();
                    const tool = ('default' in module ? module.default : module) as ToolDefinition;
                    if (tool && tool.name && tool.schema) {
                        resolved.push(tool);
                    }
                } catch (err: any) {
                    logger.error(`Failed to lazy load tool '${featureId}': ${err.message}`);
                }
            } else {
                logger.warn(`Tool '${featureId}' not found in lazy registry.`);
            }
        }
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
}

export const toolRegistry = new ToolRegistry();
