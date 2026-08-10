import type { SchemaObject } from "./types";

function resolveRef(schema: SchemaObject, definitions?: Record<string, SchemaObject>): SchemaObject {
  if (schema.$ref && definitions) {
    const name = schema.$ref.replace("#/definitions/", "").replace("#/components/schemas/", "");
    const resolved = definitions[name];
    if (resolved) return resolved;
  }
  if (schema.allOf && schema.allOf.length > 0) {
    const first = schema.allOf[0] as SchemaObject | undefined;
    if (first?.$ref && definitions) {
      const name = first.$ref.replace("#/definitions/", "").replace("#/components/schemas/", "");
      const resolved = definitions[name];
      if (resolved) return resolved;
    }
  }
  return schema;
}

export function generateExample(
  schema: SchemaObject | null,
  definitions?: Record<string, SchemaObject>,
  fieldName = "value",
  depth = 0,
): unknown {
  if (!schema) return null;
  if (depth > 5) return null;

  const s = resolveRef(schema, definitions);

  if (s.example !== undefined) return s.example;
  if (s.enum && s.enum.length > 0) return s.enum[0];

  switch (s.type) {
    case "string":
      return `<${fieldName}>`;
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array": {
      const item = s.items as SchemaObject | null;
      return [generateExample(item, definitions, "item", depth + 1)];
    }
    case "object": {
      const props = s.properties;
      if (!props) {
        const ap = s.additionalProperties;
        if (ap && typeof ap === "object") {
          return { "<key>": generateExample(ap as SchemaObject, definitions, "value", depth + 1) };
        }
        return { "<key>": "<value>" };
      }
      const out: Record<string, unknown> = {};
      for (const [name, raw] of Object.entries(props)) {
        out[name] = generateExample(raw as SchemaObject, definitions, name, depth + 1);
      }
      return out;
    }
    default:
      return null;
  }
}

export const SSE_SAMPLE = [
  'data: {"type":"metadata","missionId":"mission_8f3a2c","step":0,"seq":1,"timestamp":1712315678,"content":"Starting mission...","strategy":"nlah:v1"}',
  'data: {"type":"tool_call","toolName":"web_search","toolInput":{"query":"latest Node.js LTS version"}}',
  'data: {"type":"tool_result","toolName":"web_search","content":"Node.js v22 is the current LTS release..."}',
  'data: {"type":"content","content":"The current Node.js LTS version is v22."}',
  'data: {"type":"turn_complete","completed":true,"totalIterations":3,"totalCost":0.42}',
  "",
  ": heartbeat",
  "",
].join("\n");
