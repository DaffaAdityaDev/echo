import { SkillDefinition } from './types'

export class SkillCompiler {
  compile(skill: SkillDefinition, variables?: Record<string, string>): string {
    let prompt = skill.systemPrompt || ''
    if (variables && skill.variables) {
      for (const [key, value] of Object.entries(variables)) {
        if (skill.variables.includes(key)) {
          prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
        }
      }
    }
    return prompt
  }
}
