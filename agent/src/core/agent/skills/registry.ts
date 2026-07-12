import type { SkillDefinition } from './types'
import { standardSkills } from './library'
import { SkillCompiler } from './compiler'

export class SkillRegistry {
  private static instance: SkillRegistry
  private skills: Map<string, SkillDefinition>
  private compiler = new SkillCompiler()

  private constructor() {
    this.skills = new Map()
    for (const skill of standardSkills) {
      this.skills.set(skill.name, skill)
    }
  }

  static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry()
    }
    return SkillRegistry.instance
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name)
  }

  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values())
  }

  registerSkill(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill)
  }

  registerCustomSkill(skill: SkillDefinition): void {
    this.skills.set(`custom:${skill.name}`, skill)
  }

  compileSkillPrompts(activeSkills: string[], variables?: Record<string, string>): string {
    const parts: string[] = []
    for (const name of activeSkills) {
      const skill = this.skills.get(name)
      if (skill?.systemPrompt) {
        const compiled = this.compiler.compile(skill, variables)
        parts.push(`[${skill.name} mode]`)
        parts.push(compiled)
      }
    }
    return parts.join('\n\n')
  }

  compileModifiers(activeSkills: string[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {}
    for (const name of activeSkills) {
      const skill = this.skills.get(name)
      if (skill?.modifiers) {
        Object.assign(merged, skill.modifiers)
      }
    }
    return merged
  }

  getToolFilter(activeSkills: string[]): string[] | null {
    const allowedSets: Set<string>[] = []
    for (const name of activeSkills) {
      const skill = this.skills.get(name)
      if (skill?.allowedTools && skill.allowedTools.length > 0) {
        allowedSets.push(new Set(skill.allowedTools))
      }
    }
    if (allowedSets.length === 0) return null

    const intersection = new Set(allowedSets[0])
    for (let i = 1; i < allowedSets.length; i++) {
      const current = allowedSets[i]
      for (const item of Array.from(intersection)) {
        if (!current.has(item)) {
          intersection.delete(item)
        }
      }
    }
    return Array.from(intersection)
  }

  // TODO: SkillDefinition.modifiers.temperature and maxTokens are ready for
  // harness integration — consume them when constructing the LLM provider call.
}
