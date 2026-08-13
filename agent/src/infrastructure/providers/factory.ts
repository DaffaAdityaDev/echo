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

type ProviderCtor = new (baseUrl: string, modelName: string, apiKey?: string) => LLMProvider;

export const ProviderFactory = {
  registry: new Map<string, ProviderCtor>([
    ["opencode-go", OpenCodeGoProvider],
    ["lm-studio", LMStudioProvider],
    ["anthropic", AnthropicProvider],
    ["openai", OpenAIProvider],
  ]),

  fromConfig(config: ProviderConnectionConfig): LLMProvider {
    const Provider = ProviderFactory.registry.get(config.type);
    if (!Provider) {
      throw new Error(
        `Unknown provider type: "${config.type}". Supported types: ${[...ProviderFactory.registry.keys()].join(", ")}`,
      );
    }
    return new Provider(config.base_url, config.model, config.api_key);
  },

  resolveType(provider: LLMProvider): string | undefined {
    for (const [type, Ctor] of ProviderFactory.registry) {
      if (provider instanceof Ctor) return type;
    }
    return undefined;
  },
};
