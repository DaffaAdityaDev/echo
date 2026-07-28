export interface SpecInfo {
  title: string
  version: string
  description: string
  host?: string
  basePath?: string
}

export interface SchemaProperty {
  name: string
  type: string
  required: boolean
  description?: string
  example?: unknown
  enum?: string[]
  items?: SchemaProperty
  properties?: SchemaProperty[]
  ref?: string
}

export interface SchemaObject {
  type?: string
  description?: string
  properties?: Record<string, unknown>
  required?: string[]
  items?: unknown
  example?: unknown
  enum?: string[]
  additionalProperties?: unknown
  $ref?: string
}

export interface Parameter {
  name: string
  in: 'path' | 'query' | 'header' | 'body' | 'formData'
  required: boolean
  description?: string
  type?: string
  schema?: SchemaObject
}

export interface Response {
  statusCode: string
  description: string
  schema: SchemaObject | null
}

export interface Endpoint {
  path: string
  method: string
  summary: string
  description: string
  tags: string[]
  parameters: Parameter[]
  requestBodySchema: SchemaObject | null
  responses: Response[]
  security: Record<string, string[]>[]
}

export interface TagGroup {
  name: string
  description?: string
  endpoints: Endpoint[]
}

export interface NormalizedSpec {
  info: SpecInfo
  tags: TagGroup[]
  definitions: Record<string, SchemaObject>
}
