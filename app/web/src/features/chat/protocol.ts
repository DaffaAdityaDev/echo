import type { AgentProgress as AgentProgressType } from "./types";

export const PROTOCOL_MARKUP =
  /<(dsml|tool_calls|invoke|parameter|write_todos|delegate_task|user_objective|function)(\s[^>]*)?>[\s\S]*?<\/\1>|<\/?(dsml|tool_calls|invoke|parameter|write_todos|delegate_task|user_objective|function)\b[^>]*>/gi;

export function stripProtocolMarkup(content: string): string {
  return content.replace(PROTOCOL_MARKUP, "");
}

const URL_PREFIX = /^https?:\/\/(www\.)?/;

export function formatAgentUrl(url: string): string {
  const stripped = url.replace(URL_PREFIX, "");
  return stripped.length > 32 ? `${stripped.substring(0, 32)}...` : stripped;
}

export function buildAgentStatusMessage(progress: AgentProgressType): string {
  let statusMessage = progress.statusMessage || "Agent Orchestrating Mission...";
  if (progress.currentTool) {
    return `Executing ${progress.currentTool}...`;
  }
  if (progress.swarm?.status && progress.swarm.url) {
    const shortUrl = formatAgentUrl(progress.swarm.url);
    const statuses: Record<string, string> = {
      crawling: `Crawling ${shortUrl}...`,
      scraped: `Scraped ${shortUrl}`,
      critic_validating: `Validating facts from ${shortUrl}`,
      critic_passed: `Approved facts from ${shortUrl}`,
      critic_failed: `Retrying extraction for ${shortUrl}`,
      scrape_failed: `Failed to scrape ${shortUrl}`,
      synthesis: "Synthesizing research findings...",
    };
    statusMessage = statuses[progress.swarm.status] ?? statusMessage;
  }
  return statusMessage;
}
