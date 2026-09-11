export interface SpecInfo {
  title: string;
  version: string;
  description: string;
  host?: string;
  basePath?: string;
}

import type { JsonValue } from "@/types/json";

export interface SchemaProperty {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  enum?: string[];
  items?: SchemaProperty;
  properties?: SchemaProperty[];
  ref?: string;
}

export interface SchemaObject {
  type?: string;
  description?: string;
  properties?: Record<string, SchemaObject | JsonValue>;
  required?: string[];
  items?: unknown;
  example?: JsonValue;
  enum?: string[];
  additionalProperties?: unknown;
  $ref?: string;
  allOf?: unknown[];
}

export interface Parameter {
  name: string;
  in: "path" | "query" | "header" | "body" | "formData";
  required: boolean;
  description?: string;
  type?: string;
  schema?: SchemaObject;
}

export interface Response {
  statusCode: string;
  description: string;
  schema: SchemaObject | null;
}

export interface Endpoint {
  path: string;
  method: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: Parameter[];
  requestBodySchema: SchemaObject | null;
  responses: Response[];
  security: Array<{ [key: string]: string[] }>;
  produces?: string[];
}

export interface TagGroup {
  name: string;
  description?: string;
  endpoints: Endpoint[];
}

export interface NormalizedSpec {
  info: SpecInfo;
  tags: TagGroup[];
  definitions: Record<string, SchemaObject>;
}
