import type { CredentialManager } from "../../../core/agent/credentials";
import { ERROR_STATUS } from "../../../shared/constants/errors";
import type { JsonObject, JsonValue, Observation, ToolDefinition } from "../../../shared/types";
import { jsonSchemaToZod } from "../mcp/schema-converter";
import type { RestAuthConfig, RestToolConfig } from "./types";

export interface HeaderMap {
  [key: string]: string;
}

function isString(val: JsonValue | undefined): val is string {
  return typeof val === "string";
}

function isJsonObject(val: JsonValue | undefined | null): val is JsonObject {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function resolveEnvRefs(input: JsonObject): HeaderMap {
  const resolved: HeaderMap = {};

  for (const [key, value] of Object.entries(input)) {
    if (isString(value) && value.startsWith("$env.")) {
      const envVar = value.slice(5);
      resolved[key] = process.env[envVar] ?? "";
    } else {
      resolved[key] = value != null ? String(value) : "";
    }
  }

  return resolved;
}

const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set(["GET", "PUT", "DELETE"]);

function toParamString(val: JsonValue): string {
  return isString(val) ? val : JSON.stringify(val);
}

function interpolateUrl(template: string, params: JsonObject): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key];

    return val !== undefined ? encodeURIComponent(toParamString(val)) : `{${key}}`;
  });
}

function shouldRetry(method: string, attempt: number, maxRetries: number): boolean {
  return IDEMPOTENT_METHODS.has(method) && attempt < maxRetries - 1;
}

function buildAuthHeaders(auth: RestAuthConfig): HeaderMap {
  switch (auth.type) {
    case "bearer":
      return { Authorization: `Bearer ${auth.credentials.token ?? ""}` };
    case "basic": {
      const encoded = Buffer.from(`${auth.credentials.username ?? ""}:${auth.credentials.password ?? ""}`).toString(
        "base64",
      );

      return { Authorization: `Basic ${encoded}` };
    }

    case "header": {
      return { ...auth.credentials };
    }

    default:
      return {};
  }
}

function resolveHeaders(headers: HeaderMap | JsonObject, credentialManager?: CredentialManager): HeaderMap {
  if (credentialManager) {
    // SAFETY: headers dictionary conforms to JsonObject key-value structure
    const resolved = credentialManager.resolveForRequest(headers as JsonObject);
    const result: HeaderMap = {};

    for (const [k, v] of Object.entries(resolved)) {
      result[k] = String(v ?? "");
    }

    return result;
  }

  // SAFETY: headers object conforms to key-value string/JsonValue mappings
  return resolveEnvRefs(headers as JsonObject);
}

function traversePath(obj: JsonValue | undefined | null, path: string): JsonValue | undefined {
  const keys = path.split(".");
  let current: JsonValue | undefined | null = obj;

  for (const key of keys) {
    if (!isJsonObject(current)) return undefined;
    current = current[key];
  }

  return current ?? undefined;
}

class RestAdapter {
  private credentialManager?: CredentialManager;

  constructor(credentialManager?: CredentialManager) {
    this.credentialManager = credentialManager;
  }

  createTool(config: RestToolConfig): ToolDefinition {
    const rawSchema: JsonObject = config.schema ?? { type: "object" };
    const converted = jsonSchemaToZod(rawSchema);

    return {
      name: config.name,
      description: config.description,
      schema: converted,
      execute: async (input: JsonValue): Promise<Observation> => {
        try {
          const headers: HeaderMap = {
            ...resolveHeaders(config.global_headers ?? {}, this.credentialManager),
            ...resolveHeaders(config.headers ?? {}, this.credentialManager),
          };

          headers["Content-Type"] = headers["Content-Type"] ?? "application/json";

          const modelInput: JsonObject = isJsonObject(input) ? input : {};

          if (config.auth) {
            Object.assign(headers, buildAuthHeaders(config.auth));
          }

          let url = config.url ?? config.endpoint ?? "";

          if (config.url_interpolation) {
            url = interpolateUrl(url, modelInput);
          }

          const method = config.method ?? "POST";
          const isGetOrDelete = method === "GET" || method === "DELETE";

          if (isGetOrDelete) {
            const params = new URLSearchParams();

            for (const [k, v] of Object.entries(modelInput)) {
              params.set(k, toParamString(v));
            }

            const qs = params.toString();

            if (qs) url += (url.includes("?") ? "&" : "?") + qs;
          }

          const timeout = config.timeout ?? 30000;
          const maxRetries = 3;
          let lastError: string | undefined;

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            if (attempt > 0) {
              await Bun.sleep(1000 * 2 ** (attempt - 1));
            }

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);

            const fetchInit: RequestInit = {
              method,
              headers,
              signal: controller.signal,
            };

            if (!isGetOrDelete) {
              fetchInit.body = JSON.stringify(modelInput);
            }

            let response: Response;

            try {
              response = await fetch(url, fetchInit);
            } catch (err: unknown) {
              if (!shouldRetry(method, attempt, maxRetries)) throw err;
              lastError = err instanceof Error ? err.message : "Network error";
              continue;
            } finally {
              clearTimeout(timer);
            }

            if (response.status >= 500 && shouldRetry(method, attempt, maxRetries)) {
              lastError = `HTTP ${response.status}: ${response.statusText}`;
              continue;
            }

            if (!response.ok) {
              const body = await response.text().catch(() => "");

              return {
                status: ERROR_STATUS,
                summary: `HTTP ${response.status}: ${response.statusText}`,
                error: body || response.statusText,
              };
            }

            // SAFETY: JSON response body parsed into JsonValue or null on failure
            const data = (await response.json().catch(() => null)) as JsonValue | null;

            if (config.response_mapping) {
              const mapped: JsonObject = {};

              if (config.response_mapping.status_path) {
                mapped.status = traversePath(data, config.response_mapping.status_path) ?? null;
              }

              if (config.response_mapping.data_path) {
                mapped.data = traversePath(data, config.response_mapping.data_path) ?? null;
              }

              return {
                status: "success",
                summary: `${method} ${config.url ?? config.endpoint} → ${response.status}`,
                data: mapped,
              };
            }

            return {
              status: "success",
              summary: `${method} ${config.url ?? config.endpoint} → ${response.status}`,
              data: data ?? undefined,
            };
          }

          return {
            status: ERROR_STATUS,
            summary: lastError ?? "Unknown error",
            error: lastError ?? "Unknown error",
          };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";

          return {
            status: ERROR_STATUS,
            summary: errMsg,
            error: errMsg,
          };
        }
      },
    };
  }
}

export { RestAdapter, RestAdapter as RestToolAdapter };
