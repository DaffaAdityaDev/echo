import { ToolDefinition } from '../../../shared/types';
import { logger } from '../../../shared/utils/logger';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 1. Static Lazy-Loading Registry (Developer controlled)
export const LAZY_TOOLS: Record<string, () => Promise<{ default: ToolDefinition } | ToolDefinition>> = {
    deep_web_research: () => import('./definitions/deep-web-research'),
    delegate_task: () => import('./definitions/delegation'),
    list_files: () => import('./definitions/list-files'),
    write_todos: () => import('./definitions/planning'),
    read_file: () => import('./definitions/read-file'),
    web_scrape: () => import('./definitions/web-scrape'),
    web_search: () => import('./definitions/web-search'),
    write_file: () => import('./definitions/write-file'),
};

// 2. Active Feature catalog exposed to API and clients
export const ACTIVE_FEATURES = [
    { id: 'deep_web_research', name: 'Deep Web Research Swarm', description: 'Deploys a swarm of scraper and validation critic agents to crawl websites in parallel.', tier_requirement: 'pro' },
    { id: 'delegate_task', name: 'Sub-Agent Delegation', description: 'Enables splitting complex objectives into sub-tasks and delegating to specialist sub-agents.', tier_requirement: 'pro' },
    { id: 'web_search', name: 'Web Search', description: 'Quick search for real-time weather, prices, and news facts.', tier_requirement: 'free' },
    { id: 'web_scrape', name: 'Web Scraping', description: 'Reads single webpage content using static or fallback dynamic scraper.', tier_requirement: 'free' },
    { id: 'write_todos', name: 'Task Planning & Execution Board', description: 'Updates task board list state.', tier_requirement: 'free' },
    { id: 'read_file', name: 'File Reader', description: 'Accesses target workspace files in read-only mode.', tier_requirement: 'free' },
    { id: 'write_file', name: 'File Writer', description: 'Modifies workspace files with formatting checks.', tier_requirement: 'free' },
    { id: 'list_files', name: 'Directory File Explorer', description: 'Lists target workspace file structures.', tier_requirement: 'free' },
];

export class ToolRegistry {
    private tools: Map<string, ToolDefinition> = new Map();

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
                    if (entry.name === 'deep-web-research.ts' || entry.name === 'delegation.ts') {
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
     * If no feature array is provided, it falls back to all pre-loaded tools.
     */
    async resolveTools(features?: string[]): Promise<ToolDefinition[]> {
        if (!features || features.length === 0) {
            // Backward compatibility: return all autoloaded tools
            return this.getAllTools();
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

    getTool(name: string): ToolDefinition | undefined {
        return this.tools.get(name);
    }

    getAllTools(): ToolDefinition[] {
        return Array.from(this.tools.values());
    }
}

export const toolRegistry = new ToolRegistry();
