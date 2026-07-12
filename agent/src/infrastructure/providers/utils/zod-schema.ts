import { zodToJsonSchema } from "zod-to-json-schema";

export function zodV4ToOpenAISchema(schema: any): Record<string, any> {
    return zodToJsonSchema(schema, { target: 'openAi' }) as Record<string, any>;
}
