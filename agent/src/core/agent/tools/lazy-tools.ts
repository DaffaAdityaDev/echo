import type { ToolDefinition } from "../../../shared/types";
import { DELEGATION_CONFIG } from "./definitions/delegation/constants";
import { PLANNING_CONFIG } from "./definitions/planning/constants";
import { SEARCH_CONFIG } from "./definitions/web-search/constants";
import { type ToolRegistry, toolRegistry } from "./registry";

// 1. Static Lazy-Loading Registry (Developer controlled)
export const LAZY_TOOLS: Record<string, () => Promise<{ default: ToolDefinition } | ToolDefinition>> = {
  delegate_task: () => import("./definitions/delegation"),
  write_todos: () => import("./definitions/planning"),
  web_search: () => import("./definitions/web-search"),
};

// Feature discovery runs before tools are loaded, so unloaded entries fall
// back to the canonical description from the definition constants.
const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  delegate_task: DELEGATION_CONFIG.DESCRIPTION,
  write_todos: PLANNING_CONFIG.DESCRIPTION,
  web_search: SEARCH_CONFIG.DESCRIPTION,
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
      features.push({ id, name: id, description: FALLBACK_DESCRIPTIONS[id] ?? "" });
    }
  }
  return features.sort((a, b) => a.id.localeCompare(b.id));
}
