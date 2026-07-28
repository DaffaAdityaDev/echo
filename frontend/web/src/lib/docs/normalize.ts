import type { Endpoint, NormalizedSpec, Parameter, Response, SchemaObject, SpecInfo, TagGroup } from "./types";

function resolveRef(ref: string, definitions: Record<string, SchemaObject>): SchemaObject | null {
  const parts = ref.replace("#/definitions/", "").replace("#/components/schemas/", "");
  return definitions[parts] || null;
}

function parseSchema(raw: unknown, definitions: Record<string, SchemaObject>): SchemaObject | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (obj.$ref) {
    const resolved = resolveRef(obj.$ref as string, definitions);
    if (resolved) return resolved;
    return { $ref: obj.$ref as string };
  }

  const schema: SchemaObject = {};

  if (obj.type) schema.type = obj.type as string;
  if (obj.description) schema.description = obj.description as string;
  if (obj.example !== undefined) schema.example = obj.example;
  if (obj.enum) schema.enum = obj.enum as string[];
  if (obj.required) schema.required = obj.required as string[];

  if (obj.properties && typeof obj.properties === "object") {
    schema.properties = {} as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj.properties as Record<string, unknown>)) {
      (schema.properties as Record<string, unknown>)[key] = parseSchema(val, definitions);
    }
  }

  if (obj.items) {
    schema.items = parseSchema(obj.items, definitions);
  }

  if (obj.additionalProperties !== undefined) {
    if (typeof obj.additionalProperties === "object" && obj.additionalProperties !== null) {
      schema.additionalProperties = parseSchema(obj.additionalProperties, definitions);
    } else {
      schema.additionalProperties = obj.additionalProperties;
    }
  }

  return schema;
}

export function normalizeSpec(raw: Record<string, unknown>): NormalizedSpec {
  const definitions = (raw.definitions || {}) as Record<string, SchemaObject>;
  const rawPaths = (raw.paths || {}) as Record<string, Record<string, unknown>>;

  const info: SpecInfo = {
    title: ((raw.info as Record<string, unknown>)?.title as string) || "",
    version: ((raw.info as Record<string, unknown>)?.version as string) || "",
    description: ((raw.info as Record<string, unknown>)?.description as string) || "",
    host: raw.host as string | undefined,
    basePath: raw.basePath as string | undefined,
  };

  // Collect all endpoints
  const allEndpoints: Endpoint[] = [];

  for (const [path, methods] of Object.entries(rawPaths)) {
    for (const method of ["get", "post", "put", "delete", "patch", "options", "head"]) {
      const operation = methods[method];
      if (!operation) continue;

      const op = operation as Record<string, unknown>;

      const parameters: Parameter[] = [];
      let requestBodySchema: SchemaObject | null = null;

      const rawParams = (op.parameters || []) as Record<string, unknown>[];
      for (const p of rawParams) {
        const param: Parameter = {
          name: p.name as string,
          in: p.in as Parameter["in"],
          required: (p.required as boolean) || false,
          description: p.description as string | undefined,
        };

        if (p.in === "body" && p.schema) {
          requestBodySchema = parseSchema(p.schema, definitions);
        }

        if (p.type) {
          param.type = p.type as string;
        }
        if (p.schema && p.in !== "body") {
          const parsed = parseSchema(p.schema, definitions);
          if (parsed) param.schema = parsed;
        }

        parameters.push(param);
      }

      const responses: Response[] = [];
      const rawResponses = (op.responses || {}) as Record<string, unknown>;
      for (const [code, respRaw] of Object.entries(rawResponses)) {
        const resp = respRaw as Record<string, unknown>;
        responses.push({
          statusCode: code,
          description: (resp.description as string) || "",
          schema: resp.schema ? parseSchema(resp.schema, definitions) : null,
        });
      }

      // Sort responses (200, 201, 400, 401, 404, 500...)
      responses.sort((a, b) => {
        const aNum = parseInt(a.statusCode);
        const bNum = parseInt(b.statusCode);
        if (isNaN(aNum) && isNaN(bNum)) return a.statusCode.localeCompare(b.statusCode);
        if (isNaN(aNum)) return 1;
        if (isNaN(bNum)) return -1;
        return aNum - bNum;
      });

      allEndpoints.push({
        path,
        method,
        summary: (op.summary as string) || "",
        description: (op.description as string) || "",
        tags: (op.tags || []) as string[],
        parameters,
        requestBodySchema,
        responses,
        security: (op.security || []) as Record<string, string[]>[],
      });
    }
  }

  // Group by tags
  const tagMap = new Map<string, Endpoint[]>();
  for (const ep of allEndpoints) {
    const tag = ep.tags[0] || "Other";
    if (!tagMap.has(tag)) tagMap.set(tag, []);
    tagMap.get(tag)!.push(ep);
  }

  const tags: TagGroup[] = [];
  for (const [name, endpoints] of tagMap) {
    tags.push({ name, endpoints });
  }

  // Sort tags alphabetically
  tags.sort((a, b) => a.name.localeCompare(b.name));

  return { info, tags, definitions };
}
