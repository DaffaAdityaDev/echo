import type { JsonObject, Observation, ToolDefinition } from "../../../shared/types";
import { OPERATION_STATUS } from "./constants";

export const INVALID_TOOL_ARGUMENTS = "INVALID_TOOL_ARGUMENTS";

/** Returns an error observation when the args violate the tool's schema, otherwise null. */
export function validateToolArgs(tool: ToolDefinition, args: JsonObject): Observation | null {
  const result = tool.schema.safeParse(args);

  if (result.success) return null;

  const issues = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");

  return {
    status: OPERATION_STATUS.ERROR,
    summary: `Invalid arguments for tool ${tool.name}: ${issues}. Correct the arguments and call the tool again.`,
    error: INVALID_TOOL_ARGUMENTS,
  };
}
