const ENV_REF_RE = /\$env\.([A-Z_][A-Z0-9_]*)/g

interface CredentialMapping {
  key: string
  envRef: string
  resolved?: string
}

export class CredentialManager {
  private mappings: Map<string, CredentialMapping[]> = new Map()
  private strictMode = false

  constructor(options?: { strict?: boolean }) {
    this.strictMode = options?.strict ?? false
  }

  private resolveEnvRef(value: string, options?: { allowlist?: string[] }): string {
    return value.replace(ENV_REF_RE, (_, varName) => {
      if (options?.allowlist && !options.allowlist.includes(varName)) {
        return `$env.${varName}`
      }
      const envVal = process.env[varName]
      if (this.strictMode && (envVal === undefined || envVal === '')) {
        throw new Error(`CredentialManager: required env var $${varName} is not set`)
      }
      return envVal ?? ''
    })
  }

  private resolveDeep(value: unknown, options?: { allowlist?: string[] }): unknown {
    if (typeof value === 'string') {
      return this.resolveEnvRef(value, options)
    }
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map((v) => this.resolveDeep(v, options))
      }
      const obj: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) {
        obj[k] = this.resolveDeep(v, options)
      }
      return obj
    }
    return value
  }

  resolve<T>(config: T, options?: { strict?: boolean; allowlist?: string[] }): T {
    const prevStrict = this.strictMode
    if (options?.strict !== undefined) {
      this.strictMode = options.strict
    }
    try {
      return this.resolveDeep(config, options) as T
    } finally {
      this.strictMode = prevStrict
    }
  }

  registerToolCredentials(toolName: string, credentials: Record<string, unknown>): void {
    const entries: CredentialMapping[] = []
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string') {
        const matches = [...value.matchAll(ENV_REF_RE)]
        for (const m of matches) {
          entries.push({ key, envRef: m[1] })
        }
      }
    }
    this.mappings.set(toolName, entries)
  }

  resolveForRequest(input: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      resolved[key] = this.resolveDeep(value)
    }
    return resolved
  }

  validate(): string[] {
    const missing: string[] = []
    for (const [, entries] of this.mappings) {
      for (const entry of entries) {
        if (!process.env[entry.envRef]) {
          missing.push(entry.envRef)
        }
      }
    }
    return [...new Set(missing)]
  }

  allowlist(toolName: string, required: string[]): boolean {
    const entries = this.mappings.get(toolName) ?? []
    const available = new Set(entries.map((e) => e.envRef))
    return required.every((r) => available.has(r))
  }

  getMappings(toolName: string): CredentialMapping[] {
    return this.mappings.get(toolName) ?? []
  }

  setStrict(strict: boolean): void {
    this.strictMode = strict
  }
}
