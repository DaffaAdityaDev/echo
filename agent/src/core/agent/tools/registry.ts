import { ToolDefinition, Observation } from '../../../shared/types';
import { logger } from '../../../shared/utils/logger';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export class ToolRegistry {
    private tools: Map<string, ToolDefinition> = new Map();

    /**
     * Automatically scan and load all tools from the definitions directory.
     */
    async autoload() {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const definitionsPath = join(__dirname, 'definitions');
        try {
            const files = await readdir(definitionsPath);
            for (const file of files) {
                if (file.endsWith('.ts') || file.endsWith('.js')) {
                    const module = await import(join(definitionsPath, file));
                    const tool: ToolDefinition = module.default || module;
                    
                    if (tool && tool.name && tool.schema) {
                        this.tools.set(tool.name, tool);
                        logger.info(`Tool registered: ${tool.name}`);
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
