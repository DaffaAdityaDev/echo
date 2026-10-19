import type { JsonObject, JsonValue } from "@/types/json";
import type { Endpoint, NormalizedSpec, Parameter, Response, SchemaObject, SpecInfo, TagGroup } from "./types";

export type DefinitionsMap = { [key: string]: SchemaObject };

export type SchemaPropertiesMap = { [key: string]: SchemaObject | null };

export interface RawParameter {
  name?: string;
  in?: Parameter["in"];
  required?: boolean;
  description?: string;
  type?: string;
  schema?: JsonValue;
}

export interface RawResponse {
  description?: string;
  schema?: JsonValue;
}

export interface RawOperation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: RawParameter[];
  responses?: { [code: string]: RawResponse };
  security?: Array<{ [key: string]: string[] }>;
  produces?: string[];
}

export interface RawSwaggerDoc {
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  host?: string;
  basePath?: string;
  paths?: {
    [path: string]: {
      [method: string]: RawOperation | undefined;
    };
  };
  definitions?: DefinitionsMap;
}

function isRecord(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function resolveRef(ref: string, definitions: DefinitionsMap): SchemaObject | null {
  const parts = ref.replace("#/definitions/", "").replace("#/components/schemas/", "");

  return definitions[parts] || null;
}

function parseSchema(raw: JsonValue, definitions: DefinitionsMap): SchemaObject | null {
  if (!isRecord(raw)) return null;

  if (isString(raw.$ref)) {
    const resolved = resolveRef(raw.$ref, definitions);

    if (resolved) return resolved;

    return { $ref: raw.$ref };
  }

  const schema: SchemaObject = {};

  if (isString(raw.type)) schema.type = raw.type;

  if (isString(raw.description)) schema.description = raw.description;

  if (raw.example !== undefined) schema.example = raw.example;

  if (isStringArray(raw.enum)) schema.enum = raw.enum;

  if (isStringArray(raw.required)) schema.required = raw.required;

  if (isRecord(raw.properties)) {
    const props: SchemaPropertiesMap = {};

    for (const [key, val] of Object.entries(raw.properties)) {
      props[key] = parseSchema(val, definitions);
    }

    schema.properties = props;
  }

  if (raw.items) {
    schema.items = parseSchema(raw.items, definitions);
  }

  if (raw.additionalProperties !== undefined) {
    if (isRecord(raw.additionalProperties)) {
      schema.additionalProperties = parseSchema(raw.additionalProperties, definitions);
    } else {
      schema.additionalProperties = raw.additionalProperties;
    }
  }

  return schema;
}

export function normalizeSpec(raw: RawSwaggerDoc): NormalizedSpec {
  const definitions: DefinitionsMap = raw.definitions || {};
  const rawPaths = raw.paths || {};

  const info: SpecInfo = {
    title: raw.info?.title || "",
    version: raw.info?.version || "",
    description: raw.info?.description || "",
    host: raw.host,
    basePath: raw.basePath,
  };

  const allEndpoints: Endpoint[] = [];

  for (const [path, methods] of Object.entries(rawPaths)) {
    for (const method of ["get", "post", "put", "delete", "patch", "options", "head"]) {
      const operation = methods[method];

      if (!operation) continue;

      const parameters: Parameter[] = [];
      let requestBodySchema: SchemaObject | null = null;

      const rawParams = operation.parameters || [];

      for (const p of rawParams) {
        const param: Parameter = {
          name: p.name || "",
          in: p.in || "query",
          required: p.required || false,
          description: p.description,
        };

        if (p.in === "body" && p.schema) {
          requestBodySchema = parseSchema(p.schema, definitions);
        }

        if (p.type) {
          param.type = p.type;
        }

        if (p.schema && p.in !== "body") {
          const parsed = parseSchema(p.schema, definitions);

          if (parsed) param.schema = parsed;
        }

        parameters.push(param);
      }

      const responses: Response[] = [];
      const rawResponses = operation.responses || {};

      for (const [code, resp] of Object.entries(rawResponses)) {
        responses.push({
          statusCode: code,
          description: resp.description || "",
          schema: resp.schema ? parseSchema(resp.schema, definitions) : null,
        });
      }

      responses.sort((a, b) => {
        const aNum = parseInt(a.statusCode, 10);
        const bNum = parseInt(b.statusCode, 10);

        if (Number.isNaN(aNum) && Number.isNaN(bNum)) return a.statusCode.localeCompare(b.statusCode);

        if (Number.isNaN(aNum)) return 1;

        if (Number.isNaN(bNum)) return -1;

        return aNum - bNum;
      });

      allEndpoints.push({
        path,
        method,
        summary: operation.summary || "",
        description: operation.description || "",
        tags: operation.tags || [],
        parameters,
        requestBodySchema,
        responses,
        security: operation.security || [],
        produces: operation.produces || [],
      });
    }
  }

  const tagMap = new Map<string, Endpoint[]>();

  for (const ep of allEndpoints) {
    const tag = ep.tags[0] || "Other";

    if (!tagMap.has(tag)) tagMap.set(tag, []);
    tagMap.get(tag)?.push(ep);
  }

  const tags: TagGroup[] = [];

  for (const [name, endpoints] of tagMap) {
    tags.push({ name, endpoints });
  }

  tags.sort((a, b) => a.name.localeCompare(b.name));

  return { info, tags, definitions };
}
