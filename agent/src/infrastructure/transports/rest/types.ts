export interface RestAuthConfig {
  type: 'bearer' | 'basic' | 'header'
  credentials: Record<string, string>
}

export interface RestToolConfig {
  name: string
  description: string
  endpoint?: string
  url?: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  global_headers?: Record<string, string>
  params?: Record<string, string>
  schema?: { type: 'object'; properties: Record<string, any>; required?: string[] }
  auth?: RestAuthConfig
  timeout?: number
  url_interpolation?: boolean
  response_mapping?: { status_path?: string; data_path?: string }
}

export interface RestAdapterConfig {
  tools: RestToolConfig[]
  global_headers?: Record<string, string>
  timeout?: number
}
