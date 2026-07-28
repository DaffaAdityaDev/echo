import type { LLMProvider } from "../../shared/types";
import { AnthropicProvider } from "./anthropic";
import { LMStudioProvider } from "./lm-studio";
import { OpenAIProvider } from "./openai";
import { OpenCodeGoProvider } from "./opencode-go";

export interface ProviderConnectionConfig {
  type: "openai" | "anthropic" | "lm-studio" | "opencode-go";
  base_url: string;
  api_key?: string;
  model: string;
}

export class ProviderFactory {
  private static registry = new Map<string, new (...args: any[]) => LLMProvider>([
    ["opencode-go", OpenCodeGoProvider],
    ["lm-studio", LMStudioProvider],
    ["anthropic", AnthropicProvider],
    ["openai", OpenAIProvider],
  ]);

  static fromConfig(config: ProviderConnectionConfig): LLMProvider {
    const Provider = ProviderFactory.registry.get(config.type) ?? OpenAIProvider;
    return new Provider(config.base_url, config.model, config.api_key);
  }
}
