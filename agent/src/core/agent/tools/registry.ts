import { ToolDefinition } from '../../../shared/types';
import { logger } from '../../../shared/utils/logger';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

    getTool(name: string): ToolDefinition | undefined {
        return this.tools.get(name);
    }

    getAllTools(): ToolDefinition[] {
        return Array.from(this.tools.values());
    }
}

export const toolRegistry = new ToolRegistry();
