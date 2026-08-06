import { RestAdapter } from "../../../infrastructure/transports/rest/adapter";
import type { RestToolConfig } from "../../../infrastructure/transports/rest/types";
import type { ToolDefinition } from "../../../shared/types";

/**
 * Builds a REST tool definition WITHOUT mutating the process-global registry
 * or the shared credential manager. Used to scope a mission's REST tools to
 * that mission only; secrets live in the returned definition's closures.
 */
export function createRestTool(config: RestToolConfig): ToolDefinition {
  return new RestAdapter().createTool(config);
}

export type { RestToolConfig };
