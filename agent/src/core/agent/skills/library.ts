import type { SkillDefinition } from './types'

export const standardSkills: SkillDefinition[] = [
  {
    name: 'reasoning',
    description: 'Chain-of-thought reasoning with step-by-step analysis',
    systemPrompt: `You should approach this step-by-step. Break down complex problems into smaller parts and reason through each part before combining your conclusions.`,
    preferredTools: [],
    modifiers: { temperature: 0.3, maxTokens: 4096 },
  },
  {
    name: 'coding',
    description: 'Code generation, debugging, and software engineering tasks',
    systemPrompt: `When writing code, always include type annotations and handle error cases. Explain your architectural decisions briefly. Prefer simple, readable solutions over clever optimizations.`,
    preferredTools: ['web_search'],
    modifiers: { temperature: 0.2, maxTokens: 8192 },
  },
  {
    name: 'research',
    description: 'Deep research with web search and multi-source analysis',
    systemPrompt: `Conduct thorough research by searching multiple sources. Cross-reference information and cite your sources. If information is contradictory, note the discrepancy.`,
    preferredTools: ['web_search'],
    modifiers: { temperature: 0.5, maxTokens: 4096, compression: true },
  },
  {
    name: 'planning',
    description: 'Task decomposition, planning, and project management',
    systemPrompt: `Break down the objective into concrete, actionable tasks. Use the planning tool to create and manage todos. Track progress and update task status as you complete them.`,
    preferredTools: ['write_todos', 'delegate_task'],
    modifiers: { temperature: 0.4, maxTokens: 2048 },
  },
  {
    name: 'analyst',
    description: 'Data analysis, pattern recognition, and insight generation',
    systemPrompt: `Analyze data systematically. Look for patterns, anomalies, and correlations. Present findings with supporting evidence. Use quantitative reasoning where possible.`,
    preferredTools: ['web_search'],
    modifiers: { temperature: 0.3, maxTokens: 4096 },
  },
]
