import type { ToolDefinition } from "../../../shared/types";
import { DELEGATION_CONFIG } from "./definitions/delegation/constants";
import { PLANNING_CONFIG } from "./definitions/planning/constants";
import { SEARCH_CONFIG } from "./definitions/web-search/constants";
import { type ToolRegistry, toolRegistry } from "./registry";

export type LazyToolLoader = () => Promise<{ default: ToolDefinition } | ToolDefinition>;

export type LazyToolKey = "delegate_task" | "write_todos" | "web_search";

// 1. Static Lazy-Loading Registry (Developer controlled)
export const LAZY_TOOLS: Record<LazyToolKey, LazyToolLoader> = {
  delegate_task: () => import("./definitions/delegation"),
  write_todos: () => import("./definitions/planning"),
  web_search: () => import("./definitions/web-search"),
};

// Feature discovery runs before tools are loaded, so unloaded entries fall
// back to the canonical description from the definition constants.
const FALLBACK_DESCRIPTIONS: Record<LazyToolKey, string> = {
  delegate_task: DELEGATION_CONFIG.DESCRIPTION,
  write_todos: PLANNING_CONFIG.DESCRIPTION,
  web_search: SEARCH_CONFIG.DESCRIPTION,
};

export interface ImplementedFeature {
  id: string;
  name: string;
  description: string;
}

const LAZY_TOOL_KEYS: readonly LazyToolKey[] = ["delegate_task", "write_todos", "web_search"];

export function getImplementedFeatures(registry: ToolRegistry = toolRegistry): ImplementedFeature[] {
  const loadedById = new Map<string, ToolDefinition>();

  for (const tool of registry.getAllTools()) {
    loadedById.set(tool.name, tool);
  }

  const features: ImplementedFeature[] = [];

  for (const id of LAZY_TOOL_KEYS) {
    const tool = loadedById.get(id);

    if (tool) {
      features.push({ id, name: tool.name, description: tool.description });
    } else {
      features.push({ id, name: id, description: FALLBACK_DESCRIPTIONS[id] });
    }
  }

  return features.sort((a, b) => a.id.localeCompare(b.id));
}
