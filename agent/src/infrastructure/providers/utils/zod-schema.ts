import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { JsonObject } from "../../../shared/types";

interface ZodWithJsonExport {
  toJSONSchema?: (s: z.ZodType) => JsonObject;
}

function isFunction<T>(val: T): val is T & ((...args: never[]) => void) {
  return typeof val === "function";
}

export function zodV4ToOpenAISchema(schema: z.ZodType): JsonObject {
  // SAFETY: z instance can optionally export toJSONSchema in newer zod releases
  const zExport = z as ZodWithJsonExport;
  const toJsonSchema = zExport.toJSONSchema;

  if (isFunction(toJsonSchema)) {
    const jsonSchema = toJsonSchema(schema);
    delete jsonSchema.$schema;

    return jsonSchema;
  }

  // SAFETY: Zod schema matches zodToJsonSchema input definition
  const rawSchema = zodToJsonSchema(schema as Parameters<typeof zodToJsonSchema>[0]);
  // SAFETY: JSON schema output is a valid JSON object
  const jsonSchema = rawSchema as JsonObject;

  delete jsonSchema.$schema;

  return jsonSchema;
}
