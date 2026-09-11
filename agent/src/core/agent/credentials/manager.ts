import type { JsonObject, JsonValue } from "../../../shared/types";
import { ENV_REF_RE } from "./constants";
import type { CredentialMapping } from "./types";

function isString(value: JsonValue | undefined): value is string {
  return typeof value === "string";
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class CredentialManager {
  private mappings: Map<string, CredentialMapping[]> = new Map();
  private strictMode = false;

  constructor(options?: { strict?: boolean }) {
    this.strictMode = options?.strict ?? false;
  }

  private resolveEnvRef(value: string, options?: { allowlist?: string[] }): string {
    return value.replace(ENV_REF_RE, (_, varName) => {
      if (options?.allowlist && !options.allowlist.includes(varName)) {
        return `$env.${varName}`;
      }

      const envVal = process.env[varName];

      if (this.strictMode && (envVal === undefined || envVal === "")) {
        throw new Error(`CredentialManager: required env var $${varName} is not set`);
      }

      return envVal ?? "";
    });
  }

  private resolveDeep(value: JsonValue, options?: { allowlist?: string[] }): JsonValue {
    if (isString(value)) {
      return this.resolveEnvRef(value, options);
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.resolveDeep(v, options));
    }

    if (isJsonObject(value)) {
      const obj: JsonObject = {};

      for (const [k, v] of Object.entries(value)) {
        obj[k] = this.resolveDeep(v, options);
      }

      return obj;
    }

    return value;
  }

  resolve<T extends JsonValue>(config: T, options?: { strict?: boolean; allowlist?: string[] }): T {
    const prevStrict = this.strictMode;

    if (options?.strict !== undefined) {
      this.strictMode = options.strict;
    }

    try {
      // SAFETY: resolveDeep recursively substitutes string env references preserving the object structure
      return this.resolveDeep(config, options) as T;
    } finally {
      this.strictMode = prevStrict;
    }
  }

  registerToolCredentials(toolName: string, credentials: Record<string, string> | JsonObject): void {
    const entries: CredentialMapping[] = [];

    for (const [key, value] of Object.entries(credentials)) {
      if (isString(value)) {
        const matches = [...value.matchAll(ENV_REF_RE)];

        for (const m of matches) {
          entries.push({ key, envRef: m[1] });
        }
      }
    }

    this.mappings.set(toolName, entries);
  }

  resolveForRequest(input: JsonObject): JsonObject {
    const resolved: JsonObject = {};

    for (const [key, value] of Object.entries(input)) {
      resolved[key] = this.resolveDeep(value);
    }

    return resolved;
  }

  validate(): string[] {
    const missing: string[] = [];

    for (const [, entries] of this.mappings) {
      for (const entry of entries) {
        if (!process.env[entry.envRef]) {
          missing.push(entry.envRef);
        }
      }
    }

    return [...new Set(missing)];
  }

  allowlist(toolName: string, required: string[]): boolean {
    const entries = this.mappings.get(toolName) ?? [];
    const available = new Set(entries.map((e) => e.envRef));

    return required.every((r) => available.has(r));
  }

  getMappings(toolName: string): CredentialMapping[] {
    return this.mappings.get(toolName) ?? [];
  }

  setStrict(strict: boolean): void {
    this.strictMode = strict;
  }
}
