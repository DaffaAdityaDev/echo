import { PromptAdapter } from "../../../adapter/outbound/backend/prompt.adapter";

export interface BehaviorPrompt {
  templateName: string;
  version: number;
  systemPrompt: string;
  boundTools: string[];
  variables: string[];
}

export interface ResolveBehaviorPromptOptions {
  templateName?: string | null;
  tenantId?: string;
  adapter?: PromptAdapter;
}

export async function resolveBehaviorPrompt(opts: ResolveBehaviorPromptOptions = {}): Promise<BehaviorPrompt | null> {
  const templateName = opts.templateName;
  if (!templateName) return null;

  const adapter = opts.adapter ?? new PromptAdapter();
  const tenantId = opts.tenantId ?? "local";

  const prompt = await adapter.getActivePrompt(templateName, tenantId);
  if (!prompt) return null;

  return { ...prompt, templateName };
}
