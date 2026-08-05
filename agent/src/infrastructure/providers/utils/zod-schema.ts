import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export function zodV4ToOpenAISchema(schema: z.ZodType): Record<string, unknown> {
  const toJsonSchema = (z as unknown as { toJSONSchema?: (s: z.ZodType) => Record<string, unknown> }).toJSONSchema;
  if (typeof toJsonSchema === "function") {
    const jsonSchema = toJsonSchema(schema);
    delete jsonSchema.$schema;
    return jsonSchema;
  }
  const jsonSchema = zodToJsonSchema(schema as unknown as Parameters<typeof zodToJsonSchema>[0]) as Record<
    string,
    unknown
  >;
  delete jsonSchema.$schema;
  return jsonSchema;
}
