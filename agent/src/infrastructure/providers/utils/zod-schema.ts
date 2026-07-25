import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export function zodV4ToOpenAISchema(schema: any): Record<string, any> {
    if (typeof (z as any).toJSONSchema === "function") {
        const jsonSchema = (z as any).toJSONSchema(schema) as Record<string, any>;
        delete jsonSchema["$schema"];
        return jsonSchema;
    }
    const jsonSchema = zodToJsonSchema(schema) as Record<string, any>;
    delete jsonSchema["$schema"];
    return jsonSchema;
}
