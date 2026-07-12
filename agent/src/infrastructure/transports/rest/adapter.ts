import type { z } from 'zod'
import type { ToolDefinition, Observation } from '../../../shared/types'
import type { RestAuthConfig, RestToolConfig } from './types'
import type { CredentialManager } from '../../../core/agent/credentials/manager'
import { jsonSchemaToZod } from '../mcp/schema-converter'

function resolveEnvRefs(input: Record<string, unknown>): Record<string, string> {
  const resolved: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.startsWith('$env.')) {
      const envVar = value.slice(5)
      resolved[key] = process.env[envVar] ?? ''
    } else {
      resolved[key] = value != null ? String(value) : ''
    }
  }
  return resolved
}

function interpolateUrl(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key]
    return val !== undefined ? String(val) : `{${key}}`
  })
}

function buildAuthHeaders(auth: RestAuthConfig): Record<string, string> {
  switch (auth.type) {
    case 'bearer':
      return { Authorization: `Bearer ${auth.credentials.token ?? ''}` }
    case 'basic': {
      const encoded = Buffer.from(
        `${auth.credentials.username ?? ''}:${auth.credentials.password ?? ''}`
      ).toString('base64')
      return { Authorization: `Basic ${encoded}` }
    }
    case 'header': {
      return { ...auth.credentials }
    }
    default:
      return {}
  }
}

function resolveHeaders(
  headers: Record<string, unknown>,
  credentialManager?: CredentialManager
): Record<string, string> {
  if (credentialManager) {
    const resolved = credentialManager.resolveForRequest(headers)
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(resolved)) {
      result[k] = String(v ?? '')
    }
    return result
  }
  return resolveEnvRefs(headers)
}

function traversePath(obj: unknown, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

class RestAdapter {
  private credentialManager?: CredentialManager

  constructor(credentialManager?: CredentialManager) {
    this.credentialManager = credentialManager
  }

  createTool(config: RestToolConfig): ToolDefinition {
    const rawSchema = (config.schema ?? { type: 'object' }) as Record<string, unknown>
    const converted = jsonSchemaToZod(rawSchema)

    return {
      name: config.name,
      description: config.description,
      schema: converted as unknown as z.ZodObject<any>,
      execute: async (input: any): Promise<Observation> => {
        try {
          const headers: Record<string, string> = {
            ...resolveHeaders(config.global_headers ?? {}, this.credentialManager),
            ...resolveHeaders(config.headers ?? {}, this.credentialManager),
          }
          headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'

          const resolvedInput: Record<string, unknown> = this.credentialManager
            ? this.credentialManager.resolveForRequest(input ?? {})
            : resolveEnvRefs(input ?? {})

          if (config.auth) {
            Object.assign(headers, buildAuthHeaders(config.auth))
          }

          let url = config.url ?? config.endpoint ?? ''
          if (config.url_interpolation) {
            url = interpolateUrl(url, resolvedInput)
          }

          const method = config.method ?? 'POST'
          const isGetOrDelete = method === 'GET' || method === 'DELETE'

          if (isGetOrDelete && resolvedInput && typeof resolvedInput === 'object') {
            const params = new URLSearchParams()
            for (const [k, v] of Object.entries(resolvedInput)) {
              params.set(k, String(v))
            }
            const qs = params.toString()
            if (qs) url += (url.includes('?') ? '&' : '?') + qs
          }

          const timeout = config.timeout ?? 30000
          const maxRetries = 3
          let lastError: string | undefined

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            if (attempt > 0) {
              await Bun.sleep(1000 * Math.pow(2, attempt - 1))
            }

            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), timeout)

            const fetchInit: RequestInit = {
              method,
              headers,
              signal: controller.signal,
            }

            if (!isGetOrDelete && resolvedInput) {
              fetchInit.body = JSON.stringify(resolvedInput)
            }

            let response: Response
            try {
              response = await fetch(url, fetchInit)
            } finally {
              clearTimeout(timer)
            }

            if (response.status >= 500 && attempt < maxRetries - 1) {
              lastError = `HTTP ${response.status}: ${response.statusText}`
              continue
            }

            if (!response.ok) {
              const body = await response.text().catch(() => '')
              return {
                status: 'error',
                summary: `HTTP ${response.status}: ${response.statusText}`,
                error: body || response.statusText,
              }
            }

            const data = await response.json().catch(() => null)

            if (config.response_mapping) {
              const mapped: Record<string, unknown> = {}
              if (config.response_mapping.status_path) {
                mapped.status = traversePath(data, config.response_mapping.status_path)
              }
              if (config.response_mapping.data_path) {
                mapped.data = traversePath(data, config.response_mapping.data_path)
              }
              return {
                status: 'success',
                summary: `${method} ${config.url ?? config.endpoint} → ${response.status}`,
                data: mapped,
              }
            }

            return {
              status: 'success',
              summary: `${method} ${config.url ?? config.endpoint} → ${response.status}`,
              data: data ?? undefined,
            }
          }

          return {
            status: 'error',
            summary: lastError ?? 'Unknown error',
            error: lastError ?? 'Unknown error',
          }
        } catch (err: any) {
          return { status: 'error', summary: err.message, error: err.message }
        }
      },
    }
  }
}

export { RestAdapter, RestAdapter as RestToolAdapter }
