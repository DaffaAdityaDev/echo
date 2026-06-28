import { z } from "zod";
import { logger } from "../../../shared/utils/logger";

export function zodV4ToOpenAISchema(schema: z.ZodType<any>): Record<string, any> {
    const def = (schema as any)._def;
    if (!def) return { type: "object", properties: {} };

    const typeName = def.typeName || def.type;

    // Handle Optional / Default wrappers
    if (typeName === "ZodOptional" || typeName === "ZodDefault" || typeName === "optional" || typeName === "default") {
        const inner = def.innerType || def.schema;
        if (inner) {
            const res = zodV4ToOpenAISchema(inner);
            if (def.description) res.description = def.description;
            return res;
        }
    }

    // Handle Object
    if (typeName === "ZodObject" || typeName === "object") {
        const shape = typeof def.shape === "function" ? def.shape() : (def.shape || {});
        const properties: Record<string, any> = {};
        const required: string[] = [];

        for (const [key, propSchema] of Object.entries(shape)) {
            const propDef = (propSchema as any)?._def;
            const propTypeName = propDef?.typeName || propDef?.type;
            const isOptional = propTypeName === "ZodOptional" || propTypeName === "optional" || typeof (propSchema as any)?.isOptional === "function" && (propSchema as any).isOptional();

            properties[key] = zodV4ToOpenAISchema(propSchema as any);
            if (!isOptional) {
                required.push(key);
            }
        }

        const res: Record<string, any> = {
            type: "object",
            properties,
            additionalProperties: false
        };
        if (required.length > 0) res.required = required;
        if (def.description) res.description = def.description;
        return res;
    }

    // Handle String
    if (typeName === "ZodString" || typeName === "string") {
        const res: Record<string, any> = { type: "string" };
        if (def.description) res.description = def.description;
        return res;
    }

    // Handle Number
    if (typeName === "ZodNumber" || typeName === "number") {
        const res: Record<string, any> = { type: "number" };
        if (def.description) res.description = def.description;
        return res;
    }

    // Handle Boolean
    if (typeName === "ZodBoolean" || typeName === "boolean") {
        const res: Record<string, any> = { type: "boolean" };
        if (def.description) res.description = def.description;
        return res;
    }

    // Handle Enum
    if (typeName === "ZodEnum" || typeName === "enum") {
        const res: Record<string, any> = {
            type: "string",
            enum: def.values || []
        };
        if (def.description) res.description = def.description;
        return res;
    }

    // Handle Array
    if (typeName === "ZodArray" || typeName === "array") {
        const itemSchema = def.type || def.element;
        const res: Record<string, any> = {
            type: "array",
            items: itemSchema ? zodV4ToOpenAISchema(itemSchema) : {}
        };
        if (def.description) res.description = def.description;
        return res;
    }

    logger.warn(`zodV4ToOpenAISchema: unhandled type "${typeName}", falling back to string`);
    return { type: "string" };
}
