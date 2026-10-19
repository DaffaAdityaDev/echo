import { z } from "zod";
import type { JsonObject } from "../../../shared/types";

interface ZodJsonExport {
  toJSONSchema: (s: z.ZodType) => JsonObject;
}

export function zodV4ToOpenAISchema(schema: z.ZodType): JsonObject {
  // SAFETY: zod v4 toJSONSchema emits a plain JSON-serialisable object schema
  const { toJSONSchema } = z as ZodJsonExport;
  const jsonSchema = toJSONSchema(schema);
  delete jsonSchema.$schema;

  return jsonSchema;
}
