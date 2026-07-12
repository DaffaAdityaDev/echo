import { z } from 'zod'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  if (schema.type === 'string') {
    let s = z.string()
    if (typeof schema.description === 'string') {
      s = s.describe(schema.description)
    }
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      return z.enum(schema.enum as [string, ...string[]])
    }
    return s
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    let n = schema.type === 'integer' ? z.number().int() : z.number()
    if (typeof schema.description === 'string') {
      n = n.describe(schema.description)
    }
    return n
  }

  if (schema.type === 'boolean') {
    let b = z.boolean()
    if (typeof schema.description === 'string') {
      b = b.describe(schema.description)
    }
    return b
  }

  if (schema.type === 'array' && isObject(schema.items)) {
    let a = z.array(jsonSchemaToZod(schema.items as Record<string, unknown>))
    if (typeof schema.description === 'string') {
      a = a.describe(schema.description)
    }
    return a
  }

  if (schema.type === 'object' || schema.properties !== undefined) {
    const props = isObject(schema.properties) ? schema.properties as Record<string, unknown> : {}
    const required = Array.isArray(schema.required) ? schema.required as string[] : []
    const shape: Record<string, z.ZodTypeAny> = {}

    for (const [key, val] of Object.entries(props)) {
      if (isObject(val)) {
        const propSchema = jsonSchemaToZod(val as Record<string, unknown>)
        shape[key] = required.includes(key) ? propSchema : propSchema.optional()
      }
    }

    let obj = z.object(shape)
    if (typeof schema.description === 'string') {
      obj = obj.describe(schema.description)
    }
    return obj
  }

  return z.any()
}
