export interface SkillDefinition {
  name: string
  description: string
  systemPrompt?: string
  variables?: string[]
  preferredTools?: string[]
  allowedTools?: string[]
  modifiers?: {
    temperature?: number
    maxTokens?: number
    compression?: boolean
    pacing?: boolean
    loopDetection?: boolean
  }
}


