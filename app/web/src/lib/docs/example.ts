import type { JsonObject, JsonValue } from "@/types/json";
import type { DefinitionsMap } from "./normalize";
import type { SchemaObject } from "./types";

function isSchemaObject(value: unknown): value is SchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRef(schema: SchemaObject, definitions?: DefinitionsMap): SchemaObject {
  if (schema.$ref && definitions) {
    const name = schema.$ref.replace("#/definitions/", "").replace("#/components/schemas/", "");
    const resolved = definitions[name];

    if (resolved) return resolved;
  }

  if (schema.allOf && schema.allOf.length > 0) {
    // SAFETY: allOf contains SchemaObject elements in OpenAPI schema definitions.
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
  definitions?: DefinitionsMap,
  fieldName = "value",
  depth = 0,
): JsonValue {
  if (!schema) return null;

  if (depth > 5) return null;

  const s = resolveRef(schema, definitions);

  if (s.example !== undefined) {
    // SAFETY: Example values in schemas conform to JSON primitives/objects.
    return s.example as JsonValue;
  }

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
      // SAFETY: Array items in SchemaObject model nested schema.
      const item = (s.items as SchemaObject | null) || null;

      return [generateExample(item, definitions, "item", depth + 1)];
    }

    case "object": {
      const props = s.properties;

      if (!props) {
        const ap = s.additionalProperties;

        if (isSchemaObject(ap)) {
          return { "<key>": generateExample(ap, definitions, "value", depth + 1) };
        }

        return { "<key>": "<value>" };
      }

      const out: JsonObject = {};

      for (const [name, raw] of Object.entries(props)) {
        if (isSchemaObject(raw)) {
          out[name] = generateExample(raw, definitions, name, depth + 1);
        }
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
  'data: {"type":"error","content":"Connection timed out"}',
].join("\n");
