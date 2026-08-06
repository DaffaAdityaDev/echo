/**
 * Filter tools down to a behavior prompt's bound tool allowlist.
 * Empty boundTools means "no restriction" — the tools are returned unchanged.
 */
export function applyBoundTools<T extends { name: string }>(tools: T[], boundTools: string[]): T[] {
  if (boundTools.length === 0) return tools;
  return tools.filter((tool) => boundTools.includes(tool.name));
}
