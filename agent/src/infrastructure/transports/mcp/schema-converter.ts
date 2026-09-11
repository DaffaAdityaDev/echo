import { z } from "zod";
import type { JsonObject, JsonValue } from "../../../shared/types";

function isObject(v: JsonValue | undefined | null): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isString<T>(v: T): v is T & string {
  return typeof v === "string";
}

function isStringArray(v: JsonValue | undefined): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

export function jsonSchemaToZod(schema: JsonObject): z.ZodTypeAny {
  if (schema.type === "string") {
    let s = z.string();

    if (isString(schema.description)) {
      s = s.describe(schema.description);
    }

    if (isStringArray(schema.enum) && schema.enum.length > 0) {
      const [first, ...rest] = schema.enum;

      return z.enum([first, ...rest]);
    }

    return s;
  }

  if (schema.type === "number" || schema.type === "integer") {
    let n = schema.type === "integer" ? z.number().int() : z.number();

    if (isString(schema.description)) {
      n = n.describe(schema.description);
    }

    return n;
  }

  if (schema.type === "boolean") {
    let b = z.boolean();

    if (isString(schema.description)) {
      b = b.describe(schema.description);
    }

    return b;
  }

  if (schema.type === "array" && isObject(schema.items)) {
    let a = z.array(jsonSchemaToZod(schema.items));

    if (isString(schema.description)) {
      a = a.describe(schema.description);
    }

    return a;
  }

  if (schema.type === "object" || schema.properties !== undefined) {
    const props: JsonObject = isObject(schema.properties) ? schema.properties : {};
    const required: string[] = isStringArray(schema.required) ? schema.required : [];
    const fieldDefinitions: Record<string, z.ZodTypeAny> = {};

    for (const [key, val] of Object.entries(props)) {
      if (isObject(val)) {
        const propSchema = jsonSchemaToZod(val);
        fieldDefinitions[key] = required.includes(key) ? propSchema : propSchema.optional();
      }
    }

    let obj = z.object(fieldDefinitions);

    if (isString(schema.description)) {
      obj = obj.describe(schema.description);
    }

    return obj;
  }

  return z.any();
}
